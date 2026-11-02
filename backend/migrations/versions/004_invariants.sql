ALTER TABLE transactions ADD CONSTRAINT paired_location CHECK((latitude IS NULL)=(longitude IS NULL));
ALTER TABLE transactions ADD CONSTRAINT explicit_account_shape CHECK(
 (type='deposit' AND source_account_id IS NULL AND destination_account_id IS NOT NULL AND destination_account_id=initiated_account_id) OR
 (type='withdrawal' AND source_account_id IS NOT NULL AND destination_account_id IS NULL AND source_account_id=initiated_account_id) OR
 (type='transfer' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id<>destination_account_id AND source_account_id=initiated_account_id));
ALTER TABLE transactions ADD CONSTRAINT posted_timestamp CHECK((status IN ('posted','reversed'))=(posted_at IS NOT NULL));
CREATE FUNCTION check_reversal_completion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r public.reversal_requests%ROWTYPE;
BEGIN
 SELECT * INTO STRICT r FROM public.reversal_requests WHERE id=NEW.id;
 IF r.status IN ('posted','rejected') AND (r.analyst_id IS NULL OR r.review_reason IS NULL OR length(r.review_reason)<10) THEN
  RAISE EXCEPTION 'completed reversal requires a reviewer and reason' USING ERRCODE='23514';
 END IF;
 IF r.status='posted' AND NOT EXISTS(SELECT 1 FROM public.journals WHERE reversal_request_id=r.id) THEN
  RAISE EXCEPTION 'posted reversal requires a journal' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reversal_completed AFTER INSERT OR UPDATE ON reversal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_reversal_completion();
CREATE OR REPLACE FUNCTION post_command(cmd uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.transactions%ROWTYPE; a public.accounts%ROWTYPE; r public.reservations%ROWTYPE;
 debit_id uuid; credit_id uuid; clearing_id uuid; own_reserve bigint:=0; j uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT t FROM public.transactions WHERE id=cmd;
 IF t.status<>'pending_review' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
 SELECT id INTO STRICT clearing_id FROM public.accounts WHERE kind='clearing';
 debit_id:=coalesce(t.source_account_id,clearing_id); credit_id:=coalesce(t.destination_account_id,clearing_id);
 PERFORM id FROM public.accounts WHERE id IN(debit_id,credit_id) ORDER BY id FOR UPDATE;
 SELECT * INTO STRICT t FROM public.transactions WHERE id=cmd FOR UPDATE;
 IF t.status<>'pending_review' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
 SELECT * INTO r FROM public.reservations WHERE transaction_id=cmd AND state='active' FOR UPDATE;
 IF FOUND THEN own_reserve:=r.amount; END IF;
 IF t.type<>'deposit' AND EXISTS(SELECT 1 FROM public.fraud_evaluations WHERE transaction_id=cmd AND outcome='hold') AND (r.id IS NULL OR r.amount<>t.amount) THEN RAISE EXCEPTION 'RESERVATION_MISMATCH'; END IF;
 FOR a IN SELECT * FROM public.accounts WHERE id IN(debit_id,credit_id) LOOP
  IF a.status<>'active' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
  IF a.kind='customer' AND a.id=debit_id AND a.posted_balance-a.reserved_amount+own_reserve<t.amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  IF abs(a.posted_balance::numeric + CASE WHEN a.id=debit_id THEN -t.amount ELSE t.amount END)>9223372036854775807 THEN RAISE EXCEPTION 'AMOUNT_OVERFLOW'; END IF;
 END LOOP;
 IF own_reserve>0 THEN
  UPDATE public.accounts SET reserved_amount=reserved_amount-own_reserve WHERE id=debit_id;
  UPDATE public.reservations SET state='consumed',resolved_at=clock_timestamp() WHERE id=r.id;
 END IF;
 INSERT INTO public.journals(id,transaction_id) VALUES(j,cmd);
 INSERT INTO public.ledger_entries VALUES(gen_random_uuid(),j,debit_id,-t.amount),(gen_random_uuid(),j,credit_id,t.amount);
 UPDATE public.accounts SET posted_balance=posted_balance+CASE WHEN id=debit_id THEN -t.amount ELSE t.amount END,version=version+1 WHERE id IN(debit_id,credit_id);
 UPDATE public.transactions SET status='posted',posted_at=clock_timestamp(),version=version+1 WHERE id=cmd;
END $$;
