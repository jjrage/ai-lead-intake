-- When the lead was offered another time after missing a meeting (the touches workflow sends it once
-- the team has marked the meeting 👎 in Slack).
ALTER TABLE assistant.bookings ADD COLUMN no_show_messaged_at timestamptz;
