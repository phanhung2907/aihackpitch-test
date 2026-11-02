CREATE OR REPLACE FUNCTION balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j uuid; n integer; total numeric;
BEGIN
 IF TG_TABLE_NAME='journals' THEN j:=NEW.id; ELSE j:=NEW.journal_id; END IF;
 SELECT count(*),coalesce(sum(delta::numeric),0) INTO n,total FROM public.ledger_entries WHERE journal_id=j;
 IF n<>2 OR total<>0 THEN RAISE EXCEPTION 'unbalanced journal' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION post_reversal(req uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.reversal_requests%ROWTYPE; t public.transactions%ROWTYPE; old_j uuid; j uuid:=gen_random_uuid(); e record; a public.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT r FROM public.reversal_requests WHERE id=req;
 SELECT * INTO STRICT t FROM public.transactions WHERE id=r.original_transaction_id;
 SELECT id INTO STRICT old_j FROM public.journals WHERE transaction_id=t.id;
 PERFORM ac.id FROM public.accounts ac JOIN public.ledger_entries ent ON ent.account_id=ac.id WHERE ent.journal_id=old_j ORDER BY ac.id FOR UPDATE OF ac;
 SELECT * INTO STRICT t FROM public.transactions WHERE id=t.id FOR UPDATE;
 SELECT * INTO STRICT r FROM public.reversal_requests WHERE id=req FOR UPDATE;
 IF r.status<>'pending_review' OR t.status<>'posted' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
 FOR e IN SELECT * FROM public.ledger_entries WHERE journal_id=old_j LOOP
  SELECT * INTO STRICT a FROM public.accounts WHERE id=e.account_id;
  IF a.status<>'active' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
  IF a.kind='customer' AND a.posted_balance::numeric-e.delta-a.reserved_amount<0 THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  IF abs(a.posted_balance::numeric-e.delta)>9223372036854775807 THEN RAISE EXCEPTION 'AMOUNT_OVERFLOW'; END IF;
 END LOOP;
 INSERT INTO public.journals(id,reversal_request_id,original_journal_id) VALUES(j,req,old_j);
 INSERT INTO public.ledger_entries SELECT gen_random_uuid(),j,account_id,-delta FROM public.ledger_entries WHERE journal_id=old_j;
 UPDATE public.accounts ac SET posted_balance=ac.posted_balance-ent.delta,version=ac.version+1 FROM public.ledger_entries ent WHERE ent.journal_id=old_j AND ent.account_id=ac.id;
 UPDATE public.transactions SET status='reversed',version=version+1 WHERE id=t.id;
 UPDATE public.reversal_requests SET status='posted' WHERE id=req;
END $$;
