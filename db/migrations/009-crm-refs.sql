-- Records in CRMs other than HubSpot (whose ids have their own columns): { "gohighlevel_note": "<id>" }
-- per conversation. GoHighLevel contacts and opportunities are upserted (by email or phone, and by
-- contact and pipeline), so only the transcript note's id needs keeping.
ALTER TABLE assistant.conversations ADD COLUMN crm_refs jsonb NOT NULL DEFAULT '{}';
