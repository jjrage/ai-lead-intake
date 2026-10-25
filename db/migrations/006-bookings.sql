-- Meetings the assistant booked in an agent's calendar: what reminders, the dashboard and the CRM
-- stage "booked" read. Deleting a contact (forget_contact) deletes their bookings.
CREATE TABLE assistant.bookings (
	id               bigserial PRIMARY KEY,
	contact_id       bigint NOT NULL REFERENCES assistant.contacts (id) ON DELETE CASCADE,
	conversation_id  bigint REFERENCES assistant.conversations (id) ON DELETE SET NULL,
	meeting          text NOT NULL,                 -- the profile's meeting type, e.g. buyer_consult
	label            text NOT NULL,                 -- its name, e.g. "Buyer consultation call"
	agent            text NOT NULL,
	calendar_id      text NOT NULL,
	event_id         text,
	starts_at        timestamptz NOT NULL,
	ends_at          timestamptz NOT NULL,
	status           text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'done', 'no_show')),
	reminded_24h_at  timestamptz,
	reminded_1h_at   timestamptz,
	created_at       timestamptz NOT NULL DEFAULT now(),
	updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_upcoming ON assistant.bookings (starts_at) WHERE status = 'booked';
CREATE INDEX bookings_contact ON assistant.bookings (contact_id);

-- Records a meeting the workflow has just put in the agent's calendar (b: { meeting, label, agent,
-- calendar_id, event_id, start, end }) and moves the lead to "booked". An upcoming booking the lead
-- already had is the one being moved: it is marked cancelled (the workflow deletes its calendar
-- event). Returns { booking_id, moved_from }.
CREATE FUNCTION assistant.book_meeting(p_conversation bigint, b jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	v_contact bigint;
	v_stage   text;
	v_old     bigint;
	v_id      bigint;
BEGIN
	SELECT v.contact_id, c.stage INTO v_contact, v_stage
	FROM assistant.conversations v JOIN assistant.contacts c ON c.id = v.contact_id WHERE v.id = p_conversation;

	WITH moved AS (
		UPDATE assistant.bookings SET status = 'cancelled', updated_at = now()
		WHERE contact_id = v_contact AND status = 'booked' AND starts_at > now()
		RETURNING id
	) SELECT min(id) INTO v_old FROM moved;

	INSERT INTO assistant.bookings (contact_id, conversation_id, meeting, label, agent, calendar_id, event_id, starts_at, ends_at)
	VALUES (v_contact, p_conversation, b->>'meeting', b->>'label', b->>'agent', b->>'calendar_id', b->>'event_id',
		(b->>'start')::timestamptz, (b->>'end')::timestamptz)
	RETURNING id INTO v_id;

	UPDATE assistant.contacts SET stage = 'booked', updated_at = now() WHERE id = v_contact;
	IF v_stage <> 'booked' THEN
		INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
		VALUES (v_contact, p_conversation, 'stage_changed', jsonb_build_object('from', v_stage, 'to', 'booked'));
	END IF;
	INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
	VALUES (v_contact, p_conversation, CASE WHEN v_old IS NULL THEN 'booked' ELSE 'rescheduled' END,
		jsonb_build_object('booking_id', v_id, 'label', b->>'label', 'agent', b->>'agent', 'start', b->>'start'));
	RETURN jsonb_build_object('booking_id', v_id, 'moved_from', v_old);
END $$;

-- The lead cancelled their upcoming booking (the workflow has deleted the calendar event): the lead
-- goes back to "qualified". Returns { cancelled }: the booking id, or null if there was none.
CREATE FUNCTION assistant.cancel_booking(p_conversation bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
	v_contact bigint;
	v_id      bigint;
BEGIN
	SELECT contact_id INTO v_contact FROM assistant.conversations WHERE id = p_conversation;
	WITH gone AS (
		UPDATE assistant.bookings SET status = 'cancelled', updated_at = now()
		WHERE contact_id = v_contact AND status = 'booked' AND starts_at > now()
		RETURNING id
	) SELECT min(id) INTO v_id FROM gone;
	IF v_id IS NULL THEN RETURN jsonb_build_object('cancelled', NULL); END IF;

	UPDATE assistant.contacts SET stage = 'qualified', updated_at = now() WHERE id = v_contact AND stage = 'booked';
	IF FOUND THEN
		INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
		VALUES (v_contact, p_conversation, 'stage_changed', jsonb_build_object('from', 'booked', 'to', 'qualified'));
	END IF;
	INSERT INTO assistant.events (contact_id, conversation_id, kind, data)
	VALUES (v_contact, p_conversation, 'booking_cancelled', jsonb_build_object('booking_id', v_id));
	RETURN jsonb_build_object('cancelled', v_id);
END $$;
