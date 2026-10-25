-- Email works in draft mode: the assistant's reply is saved as a Gmail draft for a person to review
-- and send, so the message is "drafted" rather than "sent".
ALTER TABLE assistant.messages DROP CONSTRAINT messages_status_check;
ALTER TABLE assistant.messages ADD CONSTRAINT messages_status_check
	CHECK (status IN ('received', 'pending', 'sent', 'drafted', 'failed', 'skipped'));
