-- Messages the assistant sends on its own: meeting reminders, follow-ups to leads who went quiet, and
-- the touch after a missed meeting.

-- A WhatsApp template to use instead of free text when the lead's last message is more than 24 hours old
-- ({ name, language, params }); Messenger sends a reminder with the CONFIRMED_EVENT_UPDATE tag instead.
ALTER TABLE assistant.messages ADD COLUMN template jsonb;

-- Follow-ups sent since the lead last wrote.
ALTER TABLE assistant.conversations
	ADD COLUMN follow_ups smallint NOT NULL DEFAULT 0,
	ADD COLUMN followed_up_at timestamptz;

-- After a meeting the team is asked in Slack whether it happened (👍 / 👎 on that post).
ALTER TABLE assistant.bookings
	ADD COLUMN outcome_asked_at timestamptz,
	ADD COLUMN outcome_slack_ts text;

-- Queues a message no lead message prompted, on the channel the lead last wrote from (Send message
-- delivers it). Returns { message_id, channel }, or null when the lead never wrote.
CREATE FUNCTION assistant.queue_message(p_conversation bigint, p_text text, p_template jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	v_channel  text;
	v_identity text;
	v_id       bigint;
BEGIN
	SELECT m.channel, m.identity_id INTO v_channel, v_identity
	FROM assistant.messages m JOIN assistant.conversations v ON v.id = m.conversation_id
	WHERE v.contact_id = (SELECT contact_id FROM assistant.conversations WHERE id = p_conversation) AND m.direction = 'in'
	ORDER BY m.sent_at DESC, m.id DESC LIMIT 1;
	IF v_channel IS NULL THEN RETURN NULL; END IF;
	INSERT INTO assistant.messages (conversation_id, direction, author, channel, identity_id, text, sent_at, status, template)
	VALUES (p_conversation, 'out', 'ai', v_channel, v_identity, p_text, now(), 'pending', p_template)
	RETURNING id INTO v_id;
	RETURN jsonb_build_object('message_id', v_id, 'channel', v_channel);
END $$;

-- The team said whether a meeting happened: 'done' (the lead showed) or 'no_show'. Moves the lead to
-- "showed" or "no_show". Returns { conversation_id, contact_id, outcome } or null for an unknown booking.
CREATE FUNCTION assistant.booking_outcome(p_booking bigint, p_outcome text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	b       assistant.bookings;
	v_stage text;
	v_to    text := CASE p_outcome WHEN 'done' THEN 'showed' ELSE 'no_show' END;
BEGIN
	IF p_outcome NOT IN ('done', 'no_show') THEN RAISE EXCEPTION 'booking_outcome: done or no_show, not %', p_outcome; END IF;
	UPDATE assistant.bookings SET status = p_outcome, updated_at = now() WHERE id = p_booking AND status IN ('booked', 'done', 'no_show')
	RETURNING * INTO b;
	IF b.id IS NULL THEN RETURN NULL; END IF;
	SELECT stage INTO v_stage FROM assistant.contacts WHERE id = b.contact_id;
	IF v_stage IS DISTINCT FROM v_to THEN
		UPDATE assistant.contacts SET stage = v_to, updated_at = now() WHERE id = b.contact_id;
		INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
		VALUES (b.contact_id, b.conversation_id, 'stage_changed', jsonb_build_object('from', v_stage, 'to', v_to));
	END IF;
	INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
	VALUES (b.contact_id, b.conversation_id, p_outcome, jsonb_build_object('booking_id', b.id));
	RETURN jsonb_build_object('conversation_id', b.conversation_id, 'contact_id', b.contact_id, 'outcome', p_outcome);
END $$;
