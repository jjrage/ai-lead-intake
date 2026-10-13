#!/bin/bash
# The workflow's own tables, in a separate schema from n8n's: one row per inbound lead.
# The row doubles as the idempotency record (dedupe_key is unique) and the processing log.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE SCHEMA IF NOT EXISTS intake AUTHORIZATION ${POSTGRES_NON_ROOT_USER};
	SET ROLE ${POSTGRES_NON_ROOT_USER};

	CREATE TABLE IF NOT EXISTS intake.leads (
		id                  bigserial PRIMARY KEY,
		-- Web form: hash of the normalized email and message. Gmail: the message id.
		dedupe_key          text NOT NULL UNIQUE,
		source              text NOT NULL CHECK (source IN ('web_form', 'email')),
		received_at         timestamptz NOT NULL,
		status              text NOT NULL DEFAULT 'processing'
		                      CHECK (status IN ('processing', 'processed', 'not_a_lead', 'needs_review', 'error')),
		attempts            integer NOT NULL DEFAULT 1,
		duplicates          integer NOT NULL DEFAULT 0,
		last_seen_at        timestamptz NOT NULL DEFAULT now(),
		payload             jsonb NOT NULL,   -- the normalized inbound message
		category            text,
		is_hot              boolean,
		needs_review        boolean,
		result              jsonb,            -- the model's validated answer
		model               text,
		input_tokens        integer,
		output_tokens       integer,
		cost_usd            numeric(10, 6),
		hubspot_contact_id  text,
		hubspot_deal_id     text,
		gmail_draft_id      text,
		slack_ts            text,
		execution_id        text,             -- n8n execution that last worked on the lead (for the error workflow)
		error               text,
		created_at          timestamptz NOT NULL DEFAULT now(),
		updated_at          timestamptz NOT NULL DEFAULT now()
	);

	CREATE INDEX IF NOT EXISTS leads_status_idx ON intake.leads (status);
	CREATE INDEX IF NOT EXISTS leads_received_idx ON intake.leads (received_at DESC);
	CREATE INDEX IF NOT EXISTS leads_execution_idx ON intake.leads (execution_id);
EOSQL
