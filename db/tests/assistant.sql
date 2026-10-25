-- Checks the conversation functions in db/migrations/ (001, 003). Runs in a transaction and
-- rolls back, so it is safe on a live database:
--   node scripts/vps.mjs sqltest
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	IF NOT ok THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
	RAISE NOTICE 'ok   %', label;
END $$;

-- A WhatsApp lead we already know by phone.
SELECT assistant.ingest('{"profile":"test","channel":"whatsapp","external_user_id":"16025550100","external_message_id":"wamid.1","sent_at":"2026-10-20T09:00:00Z","text":"Hi from WhatsApp","sender":{"display_name":"Jane D","phone":"+16025550100"},"address":{"wa_id":"16025550100"}}') AS r \gset wa_
SELECT (:'wa_r'::jsonb->>'contact_id')::bigint AS wa_contact \gset

-- The same person writes on Telegram: a new contact until they give their phone.
SELECT assistant.ingest('{"profile":"test","channel":"telegram","external_user_id":"100","external_message_id":"100:1","sent_at":"2026-10-20T10:00:00Z","text":"hi","sender":{"display_name":"Janie"},"address":{"chat_id":100}}') AS r \gset t1_
SELECT (:'t1_r'::jsonb->>'conversation_id')::bigint AS conv, (:'t1_r'::jsonb->>'message_id')::bigint AS m1, (:'t1_r'::jsonb->>'contact_id')::bigint AS tg_contact \gset
SELECT pg_temp.expect('new telegram sender gets a new contact', :tg_contact <> :wa_contact);
SELECT pg_temp.expect('display name is not taken as the contact name', (SELECT name IS NULL FROM assistant.contacts WHERE id = :tg_contact));

SELECT pg_temp.expect('a redelivered webhook is a duplicate',
	(assistant.ingest('{"profile":"test","channel":"telegram","external_user_id":"100","external_message_id":"100:1","text":"hi"}')->>'duplicate')::boolean);
SELECT pg_temp.expect('the duplicate is stored once', (SELECT count(*) = 1 FROM assistant.messages WHERE conversation_id = :conv));

-- A burst: the first message's turn yields to the newest.
SELECT (assistant.ingest('{"profile":"test","channel":"telegram","external_user_id":"100","external_message_id":"100:2","sent_at":"2026-10-20T10:00:04Z","text":"moving to phoenix"}')->>'message_id')::bigint AS m2 \gset
SELECT pg_temp.expect('an older message in a burst does not start a turn', assistant.claim_turn(:conv, :m1, 'e1')->>'reason' = 'newer_message');
SELECT assistant.claim_turn(:conv, :m2, 'e2') AS r \gset c2_
SELECT pg_temp.expect('the newest message starts the turn', (:'c2_r'::jsonb->>'go')::boolean AND (:'c2_r'::jsonb->>'upto')::bigint = :m2);
SELECT pg_temp.expect('a second turn waits while one is running', assistant.claim_turn(:conv, :m2, 'e3')->>'reason' = 'busy');

-- A message arrives while the reply is being prepared; the lead gives the WhatsApp phone number.
SELECT (assistant.ingest('{"profile":"test","channel":"telegram","external_user_id":"100","external_message_id":"100:3","sent_at":"2026-10-20T10:00:09Z","text":"my number is 602 555 0100"}')->>'message_id')::bigint AS m3 \gset
SELECT assistant.apply_turn(:conv, '{"decision":{"action":"reply","reply":"Hi! Welcome.","contact_patch":{"name":"Jane","phone":"+16025550100","facts":{"intent":"buy"},"stage":"qualifying","language":"en"},"events":[{"kind":"stage_changed","data":{"from":"new","to":"qualifying"}}]},"ai":{"provider":"google","model":"test","ok":true,"input_tokens":10,"output_tokens":5,"cost_usd":0.0001},"reply_to":{"channel":"telegram","external_id":"100"},"execution_id":"e2"}') AS r \gset a_
SELECT pg_temp.expect('the reply is queued for sending', (:'a_r'::jsonb->>'send')::boolean);
SELECT pg_temp.expect('the WhatsApp contact is merged into this one', (:'a_r'::jsonb->'merged') @> to_jsonb(:wa_contact::bigint));
SELECT pg_temp.expect('the merged contact points to the survivor', (SELECT merged_into = :tg_contact FROM assistant.contacts WHERE id = :wa_contact));
SELECT pg_temp.expect('both channel identities belong to one person', (SELECT count(DISTINCT contact_id) = 1 AND count(*) = 2 FROM assistant.identities WHERE profile = 'test'));
SELECT pg_temp.expect('the WhatsApp message joined the open conversation', (SELECT count(*) = 1 FROM assistant.messages WHERE conversation_id = :conv AND channel = 'whatsapp'));
SELECT pg_temp.expect('the survivor keeps the phone', (SELECT phone = '+16025550100' AND name = 'Jane' FROM assistant.contacts WHERE id = :tg_contact));
SELECT assistant.finish_turn(:conv, :m2) AS r \gset f_
SELECT pg_temp.expect('a message that came in during the turn gets another turn', (:'f_r'::jsonb->>'more')::boolean AND (:'f_r'::jsonb->>'upto')::bigint = :m3);

-- A person takes over while the AI prepares its next reply: the AI reply is not sent.
SELECT pg_temp.expect('the next turn starts', (assistant.claim_turn(:conv, :m3, 'e4')->>'go')::boolean);
UPDATE assistant.conversations SET mode = 'human' WHERE id = :conv;
SELECT pg_temp.expect('a reply prepared before a takeover is skipped',
	NOT (assistant.apply_turn(:conv, '{"decision":{"action":"reply","reply":"Great!","contact_patch":{},"events":[]},"ai":{"provider":"google","model":"test","ok":true},"reply_to":{"channel":"telegram","external_id":"100"},"execution_id":"e4"}')->>'send')::boolean);
SELECT pg_temp.expect('no further AI turn while a person handles it', NOT (assistant.finish_turn(:conv, :m3)->>'more')::boolean);
SELECT pg_temp.expect('a new message in human mode does not start an AI turn', assistant.claim_turn(:conv, :m3, 'e5')->>'reason' = 'human');

-- A booking moves the lead to "booked"; booking again moves the meeting; cancelling goes back to "qualified".
SELECT assistant.book_meeting(:conv, '{"meeting":"buyer_consult","label":"Buyer consultation call","agent":"Maya Torres","calendar_id":"cal","event_id":"ev1","start":"2099-01-05T16:00:00Z","end":"2099-01-05T16:20:00Z"}') AS r \gset b1_
SELECT pg_temp.expect('a booking moves the lead to booked', (SELECT stage = 'booked' FROM assistant.contacts WHERE id = :tg_contact));
SELECT assistant.book_meeting(:conv, '{"meeting":"buyer_consult","label":"Buyer consultation call","agent":"Maya Torres","calendar_id":"cal","event_id":"ev2","start":"2099-01-06T16:00:00Z","end":"2099-01-06T16:20:00Z"}') AS r \gset b2_
SELECT pg_temp.expect('booking again moves the meeting',
	(:'b2_r'::jsonb->>'moved_from')::bigint = (:'b1_r'::jsonb->>'booking_id')::bigint
	AND (SELECT count(*) = 1 FROM assistant.bookings WHERE contact_id = :tg_contact AND status = 'booked')
	AND EXISTS (SELECT 1 FROM assistant.events WHERE contact_id = :tg_contact AND kind = 'rescheduled'));
SELECT assistant.cancel_booking(:conv) AS r \gset c1_
SELECT pg_temp.expect('cancelling goes back to qualified',
	:'c1_r'::jsonb->>'cancelled' IS NOT NULL AND (SELECT stage = 'qualified' FROM assistant.contacts WHERE id = :tg_contact));
SELECT pg_temp.expect('cancelling again finds nothing to cancel', assistant.cancel_booking(:conv)->>'cancelled' IS NULL);

-- A reminder goes out on the channel the lead last wrote from; the team marks a missed meeting.
SELECT assistant.queue_message(:conv, 'A reminder', '{"name":"appointment_reminder"}') AS r \gset q_
SELECT pg_temp.expect('a queued message goes to the channel the lead last used',
	:'q_r'::jsonb->>'channel' = 'telegram'
	AND (SELECT status = 'pending' AND template->>'name' = 'appointment_reminder' FROM assistant.messages WHERE id = (:'q_r'::jsonb->>'message_id')::bigint));
SELECT (assistant.book_meeting(:conv, '{"meeting":"buyer_consult","label":"Buyer consultation call","agent":"Maya Torres","calendar_id":"cal","event_id":"ev3","start":"2099-01-07T16:00:00Z","end":"2099-01-07T16:20:00Z"}')->>'booking_id')::bigint AS b3 \gset
SELECT assistant.booking_outcome(:b3, 'no_show') AS r \gset o_
SELECT pg_temp.expect('a missed meeting moves the lead to no_show',
	:'o_r'::jsonb->>'outcome' = 'no_show' AND (SELECT stage = 'no_show' FROM assistant.contacts WHERE id = :tg_contact));

-- Someone idle for longer than the keeping period is forgotten; an active person is kept.
SELECT (assistant.ingest('{"profile":"test","channel":"telegram","external_user_id":"200","external_message_id":"200:1","sent_at":"2026-08-01T10:00:00Z","text":"hello in August"}')->>'contact_id')::bigint AS old_contact \gset
UPDATE assistant.messages SET created_at = now() - interval '40 days' WHERE conversation_id IN (SELECT id FROM assistant.conversations WHERE contact_id = :old_contact);
UPDATE assistant.contacts SET updated_at = now() - interval '40 days' WHERE id = :old_contact;
SELECT pg_temp.expect('one idle person is forgotten', assistant.forget_inactive(interval '30 days') = 1);
SELECT pg_temp.expect('the idle person is gone', NOT EXISTS (SELECT 1 FROM assistant.contacts WHERE id = :old_contact));
SELECT pg_temp.expect('the active person is kept', EXISTS (SELECT 1 FROM assistant.contacts WHERE id = :tg_contact));

-- "Delete my data", asked by the id of a contact that was merged away: the whole person goes.
SELECT pg_temp.expect('forgetting a merged contact deletes the person and the merged contact', assistant.forget_contact(:wa_contact) = 2);
SELECT pg_temp.expect('nothing about the person is left',
	NOT EXISTS (SELECT 1 FROM assistant.contacts WHERE profile = 'test')
	AND NOT EXISTS (SELECT 1 FROM assistant.identities WHERE profile = 'test')
	AND NOT EXISTS (SELECT 1 FROM assistant.conversations WHERE id = :conv)
	AND NOT EXISTS (SELECT 1 FROM assistant.messages WHERE conversation_id = :conv)
	AND NOT EXISTS (SELECT 1 FROM assistant.ai_calls WHERE conversation_id = :conv)
	AND NOT EXISTS (SELECT 1 FROM assistant.bookings WHERE contact_id = :tg_contact));

\echo all assistant checks passed
ROLLBACK;
