-- Forgetting people: a "delete my data" request, demo data past its keeping period, or a test reset.
-- CRM records are not touched: the HubSpot contact and deal stay until deleted there.

-- Deletes a person and everything stored about them: the contacts merged into them, their channel
-- identities, conversations, messages, model calls and events. Any contact id of the person works,
-- including one that was merged away. Returns the number of contact rows deleted.
CREATE FUNCTION assistant.forget_contact(p_contact bigint) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
	v_root  bigint := p_contact;
	v_ids   bigint[];
	v_convs bigint[];
BEGIN
	WHILE (SELECT merged_into FROM assistant.contacts WHERE id = v_root) IS NOT NULL LOOP
		SELECT merged_into INTO v_root FROM assistant.contacts WHERE id = v_root;
	END LOOP;
	WITH RECURSIVE person AS (
		SELECT id FROM assistant.contacts WHERE id = v_root
		UNION SELECT c.id FROM assistant.contacts c JOIN person p ON c.merged_into = p.id
	) SELECT array_agg(id) INTO v_ids FROM person;
	IF v_ids IS NULL THEN RETURN 0; END IF;
	SELECT coalesce(array_agg(id), '{}') INTO v_convs FROM assistant.conversations WHERE contact_id = ANY (v_ids);

	DELETE FROM assistant.events WHERE contact_id = ANY (v_ids) OR conversation_id = ANY (v_convs);
	DELETE FROM assistant.messages WHERE conversation_id = ANY (v_convs);
	DELETE FROM assistant.ai_calls WHERE conversation_id = ANY (v_convs);
	DELETE FROM assistant.conversations WHERE id = ANY (v_convs);
	DELETE FROM assistant.identities WHERE contact_id = ANY (v_ids);
	DELETE FROM assistant.contacts WHERE id = ANY (v_ids);
	RETURN cardinality(v_ids);
END $$;

-- Forgets everyone who has not written or been written to for p_idle (the privacy policy promises
-- 30 days). Returns the number of people forgotten.
CREATE FUNCTION assistant.forget_inactive(p_idle interval) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
	v_id bigint;
	v_n  int := 0;
BEGIN
	FOR v_id IN
		SELECT c.id FROM assistant.contacts c
		WHERE c.merged_into IS NULL AND c.updated_at < now() - p_idle
		  AND NOT EXISTS (
			SELECT 1 FROM assistant.conversations v JOIN assistant.messages m ON m.conversation_id = v.id
			WHERE v.contact_id = c.id AND m.created_at >= now() - p_idle)
	LOOP
		PERFORM assistant.forget_contact(v_id);
		v_n := v_n + 1;
	END LOOP;
	RETURN v_n;
END $$;
