-- Answers the lead could tap under a sent message (decideTurn's quick_replies). Chat apps get them as
-- buttons when the message is sent; the website chat reads them from here.
ALTER TABLE assistant.messages ADD COLUMN quick_replies jsonb NOT NULL DEFAULT '[]';
