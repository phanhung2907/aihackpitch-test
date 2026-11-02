CREATE FUNCTION check_review_actor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE initiator uuid;
BEGIN
 IF TG_TABLE_NAME='review_actions' THEN
  SELECT actor_id INTO initiator FROM transactions WHERE id=NEW.transaction_id;
  IF NEW.analyst_id=initiator THEN RAISE EXCEPTION 'SELF_REVIEW' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.analyst_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.analyst_id=NEW.requested_by THEN RAISE EXCEPTION 'SELF_REVIEW' USING ERRCODE='23514'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.analyst_id AND role='fraud_analyst' AND enabled) THEN
  RAISE EXCEPTION 'INVALID_REVIEWER' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_actor BEFORE INSERT ON review_actions FOR EACH ROW EXECUTE FUNCTION check_review_actor();
CREATE TRIGGER reversal_actor BEFORE INSERT OR UPDATE ON reversal_requests FOR EACH ROW EXECUTE FUNCTION check_review_actor();
CREATE FUNCTION check_command_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM transactions WHERE id=NEW.id AND status IN ('posted','reversed')) AND
    NOT EXISTS(SELECT 1 FROM journals WHERE transaction_id=NEW.id) THEN
  RAISE EXCEPTION 'posted command needs a journal' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER command_posted AFTER INSERT OR UPDATE ON transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_command_journal();
