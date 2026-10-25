-- The team in Slack: a reply in a conversation's thread goes to the lead and takes the
-- conversation over from the AI; "!ai" or a ✅ hands it back.

-- Stores a team member's reply from the conversation's Slack thread as an outbound message on the
-- channel the lead last wrote from, and switches the conversation to a person. A Slack event
-- delivered twice is stored once (keyed by the Slack message ts).
-- Returns { found, duplicate, message_id, conversation_id, took_over }.
CREATE FUNCTION assistant.team_reply(p_thread text, p_text text, p_slack_ts text, p_slack_user text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	c        assistant.conversations;
	v_last   assistant.messages;
	v_msg    bigint;
	v_key    text := 'slack|' || p_slack_ts;
BEGIN
	SELECT * INTO c FROM assistant.conversations WHERE slack_thread_ts = p_thread AND status = 'open' FOR UPDATE;
	IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
	IF EXISTS (SELECT 1 FROM assistant.messages WHERE dedupe_key = v_key) THEN
		RETURN jsonb_build_object('found', true, 'duplicate', true);
	END IF;

	SELECT * INTO v_last FROM assistant.messages
	WHERE conversation_id = c.id AND direction = 'in' ORDER BY id DESC LIMIT 1;

	INSERT INTO assistant.messages (conversation_id, direction, author, channel, identity_id, dedupe_key, text, sent_at, status)
	VALUES (c.id, 'out', 'human', v_last.channel, v_last.identity_id, v_key, p_text, now(), 'pending')
	RETURNING id INTO v_msg;

	UPDATE assistant.conversations SET
		mode = 'human',
		handoff_reason = coalesce(handoff_reason, 'taken over by the team'),
		answered_upto = greatest(answered_upto, v_last.id),
		updated_at = now()
	WHERE id = c.id;
	IF c.mode = 'ai' THEN
		INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
		VALUES (c.contact_id, c.id, 'takeover', jsonb_build_object('slack_user', p_slack_user));
	END IF;

	RETURN jsonb_build_object('found', true, 'duplicate', false, 'message_id', v_msg, 'conversation_id', c.id,
		'took_over', c.mode = 'ai');
END $$;

-- Gives the conversation in this Slack thread back to the AI. What the lead wrote before counts as
-- answered: the AI picks up from the lead's next message. Returns { found, changed, conversation_id }.
CREATE FUNCTION assistant.team_handback(p_thread text, p_slack_user text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	c assistant.conversations;
BEGIN
	SELECT * INTO c FROM assistant.conversations WHERE slack_thread_ts = p_thread AND status = 'open' FOR UPDATE;
	IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
	IF c.mode = 'ai' THEN RETURN jsonb_build_object('found', true, 'changed', false, 'conversation_id', c.id); END IF;

	UPDATE assistant.conversations SET
		mode = 'ai',
		handoff_reason = NULL,
		answered_upto = greatest(answered_upto, coalesce((SELECT max(id) FROM assistant.messages WHERE conversation_id = c.id AND direction = 'in'), 0)),
		updated_at = now()
	WHERE id = c.id;
	INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
	VALUES (c.contact_id, c.id, 'handback', jsonb_build_object('slack_user', p_slack_user));
	RETURN jsonb_build_object('found', true, 'changed', true, 'conversation_id', c.id);
END $$;
