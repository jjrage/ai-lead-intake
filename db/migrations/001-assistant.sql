-- Conversation assistant (v2): one person across channels, one open conversation per person,
-- every message stored once. Applied by scripts/vps.mjs migrate as the n8n database user.

CREATE SCHEMA IF NOT EXISTS assistant;

-- A person, whatever channels they write from. Found by channel identity first, then by phone or email.
CREATE TABLE assistant.contacts (
	id              bigserial PRIMARY KEY,
	profile         text NOT NULL,                  -- business profile, profiles/<profile>.json
	name            text,
	email           text,                           -- lower case
	phone           text,                           -- E.164
	language        text,                           -- ISO 639-1, the language the person writes in
	stage           text NOT NULL DEFAULT 'new'
	                  CHECK (stage IN ('new', 'qualifying', 'qualified', 'booked', 'showed', 'no_show', 'lost')),
	facts           jsonb NOT NULL DEFAULT '{}',    -- qualification answers collected so far
	is_hot          boolean NOT NULL DEFAULT false,
	crm_contact_id  text,
	crm_deal_id     text,
	opted_out_at    timestamptz,                    -- asked not to be contacted: no AI replies, no follow-ups
	merged_into     bigint REFERENCES assistant.contacts (id),
	created_at      timestamptz NOT NULL DEFAULT now(),
	updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_email_uq ON assistant.contacts (profile, email) WHERE email IS NOT NULL AND merged_into IS NULL;
CREATE UNIQUE INDEX contacts_phone_uq ON assistant.contacts (profile, phone) WHERE phone IS NOT NULL AND merged_into IS NULL;

-- Where a person can be reached: a WhatsApp number, a Messenger PSID, a Telegram chat, a web chat session.
CREATE TABLE assistant.identities (
	profile          text NOT NULL,
	channel          text NOT NULL,
	external_id      text NOT NULL,
	contact_id       bigint NOT NULL REFERENCES assistant.contacts (id),
	display_name     text,                          -- the name on their chat profile, often a nickname
	address          jsonb NOT NULL DEFAULT '{}',   -- what the channel's sender needs (chat id, page id, ...)
	last_inbound_at  timestamptz,                   -- Meta channels: free-form replies only within 24 hours of this
	created_at       timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (profile, channel, external_id)
);
CREATE INDEX identities_contact_idx ON assistant.identities (contact_id);

CREATE TABLE assistant.conversations (
	id               bigserial PRIMARY KEY,
	contact_id       bigint NOT NULL REFERENCES assistant.contacts (id),
	status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
	mode             text NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'human')),  -- who answers the lead
	handoff_reason   text,
	slack_thread_ts  text,                          -- the team's Slack thread about this conversation
	crm_note_id      text,                          -- the CRM note that holds the transcript
	-- An AI reply is being prepared: a lock that expires after 2 minutes, and the n8n execution
	-- holding it (the error workflow releases it if that execution fails).
	turn_started_at  timestamptz,
	turn_execution   text,
	answered_upto    bigint NOT NULL DEFAULT 0,     -- last inbound message id the AI or a person has answered
	last_inbound_at  timestamptz,
	last_outbound_at timestamptz,
	created_at       timestamptz NOT NULL DEFAULT now(),
	updated_at       timestamptz NOT NULL DEFAULT now(),
	closed_at        timestamptz
);
CREATE UNIQUE INDEX conversations_open_uq ON assistant.conversations (contact_id) WHERE status = 'open';

CREATE TABLE assistant.messages (
	id               bigserial PRIMARY KEY,
	conversation_id  bigint NOT NULL REFERENCES assistant.conversations (id),
	direction        text NOT NULL CHECK (direction IN ('in', 'out')),
	author           text NOT NULL CHECK (author IN ('lead', 'ai', 'human', 'system')),
	channel          text NOT NULL,
	identity_id      text,                          -- identities.external_id it came from or goes to
	-- profile|channel|provider message id: a webhook delivered twice is stored once.
	dedupe_key       text UNIQUE,
	text             text NOT NULL DEFAULT '',
	attachments      jsonb NOT NULL DEFAULT '[]',
	sent_at          timestamptz NOT NULL,          -- provider timestamp (inbound) or send time (outbound)
	status           text NOT NULL DEFAULT 'received'
	                   CHECK (status IN ('received', 'pending', 'sent', 'failed', 'skipped')),
	provider_id      text,                          -- outbound: the id the channel returned
	error            text,
	ai_call_id       bigint,
	created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON assistant.messages (conversation_id, sent_at, id);

-- Every model call: what it cost and what it returned.
CREATE TABLE assistant.ai_calls (
	id               bigserial PRIMARY KEY,
	conversation_id  bigint REFERENCES assistant.conversations (id),
	purpose          text NOT NULL,                 -- reply, ...
	provider         text NOT NULL,
	model            text NOT NULL,
	input_tokens     integer,
	output_tokens    integer,
	cost_usd         numeric(10, 6),
	latency_ms       integer,
	stop_reason      text,
	ok               boolean NOT NULL,
	error            text,
	result           jsonb,
	execution_id     text,
	created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_conversation_idx ON assistant.ai_calls (conversation_id);

-- What happened, for the dashboard and the audit trail: stage changes, hand-offs, opt-outs, merges.
CREATE TABLE assistant.events (
	id               bigserial PRIMARY KEY,
	contact_id       bigint REFERENCES assistant.contacts (id),
	conversation_id  bigint REFERENCES assistant.conversations (id),
	kind             text NOT NULL,
	data             jsonb NOT NULL DEFAULT '{}',
	created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_kind_idx ON assistant.events (kind, created_at);

-- Stores one inbound message in the common format every channel workflow produces:
--   { profile, channel, external_user_id, external_message_id, sent_at, text, attachments,
--     sender: { name, display_name, username, phone, email }, address: { ... } }
-- sender.name is a name the person gave (a form field); display_name is a chat profile name,
-- kept on the identity only, since it is often a nickname.
-- Finds or creates the person and their open conversation. Returns
--   { duplicate, message_id, conversation_id, contact_id, mode, opted_out }.
CREATE FUNCTION assistant.ingest(m jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	v_profile  text := m->>'profile';
	v_channel  text := m->>'channel';
	v_user     text := m->>'external_user_id';
	v_sent     timestamptz := coalesce((m->>'sent_at')::timestamptz, now());
	v_name     text := nullif(m->'sender'->>'name', '');
	v_display  text := coalesce(nullif(m->'sender'->>'display_name', ''), nullif(m->'sender'->>'name', ''));
	v_phone    text := nullif(m->'sender'->>'phone', '');
	v_email    text := lower(nullif(m->'sender'->>'email', ''));
	v_key      text := v_profile || '|' || v_channel || '|' || (m->>'external_message_id');
	v_contact  bigint;
	v_conv     bigint;
	v_msg      bigint;
	v_mode     text;
	v_opted    boolean;
BEGIN
	IF v_profile IS NULL OR v_channel IS NULL OR v_user IS NULL OR m->>'external_message_id' IS NULL THEN
		RAISE EXCEPTION 'ingest: profile, channel, external_user_id and external_message_id are required';
	END IF;

	-- One sender at a time: two messages from a new person arriving together must not create two contacts.
	PERFORM pg_advisory_xact_lock(hashtext(v_profile || '|' || v_channel || '|' || v_user));

	SELECT conversation_id INTO v_conv FROM assistant.messages WHERE dedupe_key = v_key;
	IF FOUND THEN
		RETURN jsonb_build_object('duplicate', true, 'conversation_id', v_conv);
	END IF;

	SELECT contact_id INTO v_contact FROM assistant.identities
	WHERE profile = v_profile AND channel = v_channel AND external_id = v_user;

	IF v_contact IS NULL THEN
		-- New on this channel: the same person may already be known by phone or email from another one.
		SELECT id INTO v_contact FROM assistant.contacts
		WHERE profile = v_profile AND merged_into IS NULL
		  AND ((v_phone IS NOT NULL AND phone = v_phone) OR (v_email IS NOT NULL AND email = v_email))
		ORDER BY (phone = v_phone) DESC NULLS LAST, id LIMIT 1;
		IF v_contact IS NULL THEN
			INSERT INTO assistant.contacts (profile, name, phone, email)
			VALUES (v_profile, v_name, v_phone, v_email)
			RETURNING id INTO v_contact;
		END IF;
		INSERT INTO assistant.identities (profile, channel, external_id, contact_id, display_name, address)
		VALUES (v_profile, v_channel, v_user, v_contact, v_display, coalesce(m->'address', '{}'));
	END IF;

	-- Follow merges to the surviving contact.
	WHILE (SELECT merged_into FROM assistant.contacts WHERE id = v_contact) IS NOT NULL LOOP
		SELECT merged_into INTO v_contact FROM assistant.contacts WHERE id = v_contact;
	END LOOP;

	UPDATE assistant.identities SET
		last_inbound_at = greatest(last_inbound_at, v_sent),
		display_name = coalesce(v_display, display_name),
		address = address || coalesce(m->'address', '{}')
	WHERE profile = v_profile AND channel = v_channel AND external_id = v_user;

	SELECT id, mode INTO v_conv, v_mode FROM assistant.conversations WHERE contact_id = v_contact AND status = 'open';
	IF v_conv IS NULL THEN
		INSERT INTO assistant.conversations (contact_id) VALUES (v_contact) RETURNING id, mode INTO v_conv, v_mode;
	END IF;

	INSERT INTO assistant.messages (conversation_id, direction, author, channel, identity_id, dedupe_key, text, attachments, sent_at)
	VALUES (v_conv, 'in', 'lead', v_channel, v_user, v_key, coalesce(m->>'text', ''), coalesce(m->'attachments', '[]'), v_sent)
	RETURNING id INTO v_msg;

	UPDATE assistant.conversations SET last_inbound_at = greatest(last_inbound_at, v_sent), updated_at = now() WHERE id = v_conv;
	SELECT opted_out_at IS NOT NULL INTO v_opted FROM assistant.contacts WHERE id = v_contact;

	RETURN jsonb_build_object('duplicate', false, 'message_id', v_msg, 'conversation_id', v_conv,
		'contact_id', v_contact, 'mode', v_mode, 'opted_out', v_opted);
END $$;

-- Called after the short wait that lets a burst of messages arrive. Starts an AI turn only if this
-- message is still the newest unanswered one, the AI (not a person) is answering, and no other
-- turn is running. Returns { go, reason, upto }: upto is the newest inbound message the turn covers.
CREATE FUNCTION assistant.claim_turn(p_conversation bigint, p_message bigint, p_execution text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	c       assistant.conversations;
	v_last  bigint;
	v_opted boolean;
BEGIN
	SELECT * INTO c FROM assistant.conversations WHERE id = p_conversation FOR UPDATE;
	SELECT max(id) INTO v_last FROM assistant.messages WHERE conversation_id = p_conversation AND direction = 'in';
	SELECT opted_out_at IS NOT NULL INTO v_opted FROM assistant.contacts WHERE id = c.contact_id;

	IF c.status <> 'open' THEN RETURN jsonb_build_object('go', false, 'reason', 'closed'); END IF;
	IF c.mode <> 'ai' THEN RETURN jsonb_build_object('go', false, 'reason', 'human', 'upto', v_last); END IF;
	IF v_opted THEN RETURN jsonb_build_object('go', false, 'reason', 'opted_out'); END IF;
	IF v_last > p_message THEN RETURN jsonb_build_object('go', false, 'reason', 'newer_message'); END IF;
	IF v_last <= c.answered_upto THEN RETURN jsonb_build_object('go', false, 'reason', 'answered'); END IF;
	IF c.turn_started_at > now() - interval '2 minutes' THEN RETURN jsonb_build_object('go', false, 'reason', 'busy'); END IF;

	UPDATE assistant.conversations SET turn_started_at = now(), turn_execution = p_execution, updated_at = now() WHERE id = p_conversation;
	RETURN jsonb_build_object('go', true, 'upto', v_last);
END $$;

-- Ends an AI turn. Marks the inbound messages up to p_upto as answered and reports whether more
-- arrived meanwhile (the caller then runs another turn), so a message that came in while a reply
-- was being prepared is never left unanswered.
CREATE FUNCTION assistant.finish_turn(p_conversation bigint, p_upto bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	v_last bigint;
	v_mode text;
BEGIN
	UPDATE assistant.conversations
	SET turn_started_at = NULL, turn_execution = NULL, answered_upto = greatest(answered_upto, p_upto), updated_at = now()
	WHERE id = p_conversation
	RETURNING mode INTO v_mode;
	SELECT max(id) INTO v_last FROM assistant.messages WHERE conversation_id = p_conversation AND direction = 'in';
	RETURN jsonb_build_object('more', v_mode = 'ai' AND coalesce(v_last, 0) > p_upto, 'upto', v_last);
END $$;

-- Folds contact p_from into p_into: identities, conversations and messages move over, gaps in the
-- surviving contact are filled from the other one, and p_from is marked as merged.
CREATE FUNCTION assistant.merge_contacts(p_into bigint, p_from bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
	f          assistant.contacts;
	v_into     bigint;
	v_from     bigint;
	-- Further along wins; an active stage beats lost or no-show.
	v_rank     text[] := ARRAY['lost', 'no_show', 'new', 'qualifying', 'qualified', 'booked', 'showed'];
BEGIN
	IF p_into = p_from THEN RETURN; END IF;
	SELECT * INTO f FROM assistant.contacts WHERE id = p_from FOR UPDATE;

	UPDATE assistant.identities SET contact_id = p_into WHERE contact_id = p_from;

	SELECT id INTO v_into FROM assistant.conversations WHERE contact_id = p_into AND status = 'open';
	SELECT id INTO v_from FROM assistant.conversations WHERE contact_id = p_from AND status = 'open';
	IF v_from IS NOT NULL AND v_into IS NOT NULL THEN
		-- Both were talking to us: one conversation, and a person handling either one keeps it.
		UPDATE assistant.messages SET conversation_id = v_into WHERE conversation_id = v_from;
		UPDATE assistant.conversations i SET
			mode = CASE WHEN o.mode = 'human' THEN 'human' ELSE i.mode END,
			handoff_reason = coalesce(i.handoff_reason, o.handoff_reason),
			slack_thread_ts = coalesce(i.slack_thread_ts, o.slack_thread_ts),
			crm_note_id = coalesce(i.crm_note_id, o.crm_note_id),
			answered_upto = greatest(i.answered_upto, o.answered_upto),
			updated_at = now()
		FROM assistant.conversations o WHERE i.id = v_into AND o.id = v_from;
		UPDATE assistant.conversations SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = v_from;
	END IF;
	UPDATE assistant.conversations SET contact_id = p_into WHERE contact_id = p_from;
	UPDATE assistant.events SET contact_id = p_into WHERE contact_id = p_from;

	-- Free p_from's email and phone (unique among unmerged contacts) before copying them.
	UPDATE assistant.contacts SET merged_into = p_into, updated_at = now() WHERE id = p_from;
	UPDATE assistant.contacts SET
		name = coalesce(name, f.name),
		email = coalesce(email, f.email),
		phone = coalesce(phone, f.phone),
		language = coalesce(language, f.language),
		facts = f.facts || facts,
		stage = CASE WHEN array_position(v_rank, f.stage) > array_position(v_rank, stage) THEN f.stage ELSE stage END,
		is_hot = is_hot OR f.is_hot,
		crm_contact_id = coalesce(crm_contact_id, f.crm_contact_id),
		crm_deal_id = coalesce(crm_deal_id, f.crm_deal_id),
		opted_out_at = coalesce(opted_out_at, f.opted_out_at),
		updated_at = now()
	WHERE id = p_into;
	INSERT INTO assistant.events (contact_id, kind, data) VALUES (p_into, 'merged', jsonb_build_object('from', p_from));
END $$;

-- Saves one AI turn: the model call, the contact update (merging with a person already known by
-- the phone or email the lead just gave), events, a hand-off, and the reply to send. p_turn:
--   { decision: decideTurn() result, ai: { provider, model, input_tokens, output_tokens, cost_usd,
--     latency_ms, stop_reason, ok, error, result }, reply_to: { channel, external_id }, execution_id }
-- If a person took over while the reply was being prepared, the reply is stored as skipped.
-- Returns { send, message_id, contact_id, mode, merged }.
CREATE FUNCTION assistant.apply_turn(p_conversation bigint, p_turn jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	d          jsonb := p_turn->'decision';
	p          jsonb := coalesce(p_turn->'decision'->'contact_patch', '{}');
	a          jsonb := p_turn->'ai';
	c          assistant.conversations;
	v_profile  text;
	v_other    bigint;
	v_call     bigint;
	v_msg      bigint;
	v_send     boolean;
	v_merged   bigint[] := '{}';
	e          jsonb;
BEGIN
	SELECT * INTO c FROM assistant.conversations WHERE id = p_conversation FOR UPDATE;
	SELECT profile INTO v_profile FROM assistant.contacts WHERE id = c.contact_id;

	INSERT INTO assistant.ai_calls (conversation_id, purpose, provider, model, input_tokens, output_tokens, cost_usd,
		latency_ms, stop_reason, ok, error, result, execution_id)
	VALUES (p_conversation, 'reply', a->>'provider', a->>'model', (a->>'input_tokens')::int, (a->>'output_tokens')::int,
		(a->>'cost_usd')::numeric, (a->>'latency_ms')::int, a->>'stop_reason', coalesce((a->>'ok')::boolean, false),
		a->>'error', a->'result', p_turn->>'execution_id')
	RETURNING id INTO v_call;

	FOR v_other IN
		SELECT id FROM assistant.contacts
		WHERE profile = v_profile AND merged_into IS NULL AND id <> c.contact_id
		  AND ((p->>'email' IS NOT NULL AND email = p->>'email') OR (p->>'phone' IS NOT NULL AND phone = p->>'phone'))
	LOOP
		PERFORM assistant.merge_contacts(c.contact_id, v_other);
		v_merged := v_merged || v_other;
	END LOOP;

	UPDATE assistant.contacts SET
		name = coalesce(name, p->>'name'),
		email = coalesce(email, p->>'email'),
		phone = coalesce(phone, p->>'phone'),
		language = coalesce(p->>'language', language),
		facts = facts || coalesce(p->'facts', '{}'),
		stage = coalesce(p->>'stage', stage),
		is_hot = is_hot OR coalesce((p->>'is_hot')::boolean, false),
		opted_out_at = CASE WHEN coalesce((p->>'opted_out')::boolean, false) THEN coalesce(opted_out_at, now()) ELSE opted_out_at END,
		updated_at = now()
	WHERE id = c.contact_id;

	FOR e IN SELECT * FROM jsonb_array_elements(coalesce(d->'events', '[]')) LOOP
		INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
		VALUES (c.contact_id, p_conversation, e->>'kind', coalesce(e->'data', '{}'));
	END LOOP;

	v_send := c.mode = 'ai' AND coalesce(d->>'reply', '') <> '';
	INSERT INTO assistant.messages (conversation_id, direction, author, channel, identity_id, text, sent_at, status, ai_call_id)
	VALUES (p_conversation, 'out', 'ai', p_turn->'reply_to'->>'channel', p_turn->'reply_to'->>'external_id',
		coalesce(d->>'reply', ''), now(), CASE WHEN v_send THEN 'pending' ELSE 'skipped' END, v_call)
	RETURNING id INTO v_msg;

	IF d->>'action' = 'handoff' AND c.mode = 'ai' THEN
		UPDATE assistant.conversations SET mode = 'human', handoff_reason = d->>'handoff_reason', updated_at = now()
		WHERE id = p_conversation;
	END IF;

	RETURN jsonb_build_object('send', v_send, 'message_id', v_msg, 'contact_id', c.contact_id, 'merged', to_jsonb(v_merged),
		'mode', CASE WHEN d->>'action' = 'handoff' THEN 'human' ELSE c.mode END);
END $$;
