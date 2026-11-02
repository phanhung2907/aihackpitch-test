CREATE TABLE branches (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1
);
CREATE TABLE customers (
 id uuid PRIMARY KEY, full_name text NOT NULL, email text NOT NULL UNIQUE, phone text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE users (
 id uuid PRIMARY KEY, login text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('customer','teller','fraud_analyst','admin')),
 customer_id uuid UNIQUE REFERENCES customers(id), branch_id uuid REFERENCES branches(id),
 enabled boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 CHECK((role='customer' AND customer_id IS NOT NULL AND branch_id IS NULL) OR
 (role='teller' AND branch_id IS NOT NULL AND customer_id IS NULL) OR
 (role IN ('admin','fraud_analyst') AND customer_id IS NULL AND branch_id IS NULL))
);
CREATE TABLE admin_guard (id integer PRIMARY KEY CHECK(id=1)); INSERT INTO admin_guard VALUES(1);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_throttles (key_hash text PRIMARY KEY, failure_count integer NOT NULL DEFAULT 0,
 window_started_at timestamptz NOT NULL, blocked_until timestamptz);
CREATE TABLE accounts (
 id uuid PRIMARY KEY, number text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('customer','clearing')),
 customer_id uuid REFERENCES customers(id), currency text NOT NULL DEFAULT 'VND' CHECK(currency='VND'),
 label text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','frozen','closed')),
 posted_balance bigint NOT NULL DEFAULT 0, reserved_amount bigint NOT NULL DEFAULT 0,
 next_sequence bigint NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((kind='customer' AND customer_id IS NOT NULL AND posted_balance>=reserved_amount AND reserved_amount>=0)
 OR (kind='clearing' AND customer_id IS NULL AND reserved_amount=0))
);
CREATE UNIQUE INDEX one_clearing ON accounts(kind) WHERE kind='clearing';
CREATE TABLE rule_versions (
 id uuid PRIMARY KEY, version integer NOT NULL UNIQUE, high_amount_vnd bigint NOT NULL CHECK(high_amount_vnd>0),
 distance_km integer NOT NULL CHECK(distance_km BETWEEN 1 AND 20040),
 rapid_amount_vnd bigint NOT NULL CHECK(rapid_amount_vnd>0), rapid_seconds integer NOT NULL CHECK(rapid_seconds BETWEEN 1 AND 3600),
 created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE rule_configuration (id integer PRIMARY KEY CHECK(id=1), active_version_id uuid NOT NULL REFERENCES rule_versions(id), version integer NOT NULL);
CREATE TABLE transactions (
 id uuid PRIMARY KEY, type text NOT NULL CHECK(type IN ('deposit','withdrawal','transfer')),
 source_account_id uuid REFERENCES accounts(id), destination_account_id uuid REFERENCES accounts(id),
 initiated_account_id uuid NOT NULL REFERENCES accounts(id), actor_id uuid NOT NULL REFERENCES users(id),
 branch_id uuid REFERENCES branches(id), amount bigint NOT NULL CHECK(amount>0),
 status text NOT NULL CHECK(status IN ('pending_review','posted','rejected','reversed')),
 received_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 account_sequence bigint NOT NULL, location_source text NOT NULL CHECK(location_source IN ('branch','demo_client','unavailable')),
 latitude double precision, longitude double precision, posted_at timestamptz, version integer NOT NULL DEFAULT 1,
 UNIQUE(initiated_account_id,account_sequence),
 CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
 CHECK((type='deposit' AND source_account_id IS NULL AND destination_account_id=initiated_account_id)
 OR (type='withdrawal' AND destination_account_id IS NULL AND source_account_id=initiated_account_id)
 OR (type='transfer' AND source_account_id=initiated_account_id AND destination_account_id IS NOT NULL AND source_account_id<>destination_account_id))
);
CREATE INDEX tx_sequence ON transactions(initiated_account_id,account_sequence DESC);
CREATE INDEX tx_rapid ON transactions(initiated_account_id,received_at) WHERE status IN ('posted','pending_review');
CREATE INDEX tx_source ON transactions(source_account_id,created_at DESC,id);
CREATE INDEX tx_destination ON transactions(destination_account_id,created_at DESC,id);
CREATE TABLE fraud_evaluations (id uuid PRIMARY KEY, transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
 rule_version_id uuid NOT NULL REFERENCES rule_versions(id), outcome text NOT NULL CHECK(outcome IN ('allow','hold')),
 results jsonb NOT NULL, evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE fraud_alerts (id uuid PRIMARY KEY, transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
 status text NOT NULL CHECK(status IN ('open','approved','rejected')), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz);
CREATE INDEX alerts_inbox ON fraud_alerts(status,created_at,id);
CREATE TABLE reservations (id uuid PRIMARY KEY, transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
 account_id uuid NOT NULL REFERENCES accounts(id), amount bigint NOT NULL CHECK(amount>0),
 state text NOT NULL CHECK(state IN ('active','consumed','released')), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz);
CREATE INDEX active_reserve ON reservations(account_id) WHERE state='active';
CREATE TABLE reversal_requests (id uuid PRIMARY KEY, original_transaction_id uuid NOT NULL REFERENCES transactions(id),
 requested_by uuid NOT NULL REFERENCES users(id), reason text NOT NULL, status text NOT NULL CHECK(status IN ('pending_review','posted','rejected')),
 analyst_id uuid REFERENCES users(id), review_reason text, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE UNIQUE INDEX one_reversal ON reversal_requests(original_transaction_id) WHERE status IN ('pending_review','posted');
CREATE TABLE journals (id uuid PRIMARY KEY, transaction_id uuid UNIQUE REFERENCES transactions(id),
 reversal_request_id uuid UNIQUE REFERENCES reversal_requests(id), original_journal_id uuid UNIQUE REFERENCES journals(id),
 posted_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK((transaction_id IS NULL)<>(reversal_request_id IS NULL)));
CREATE TABLE ledger_entries (id uuid PRIMARY KEY, journal_id uuid NOT NULL REFERENCES journals(id),
 account_id uuid NOT NULL REFERENCES accounts(id), delta bigint NOT NULL CHECK(delta<>0), UNIQUE(journal_id,account_id));
CREATE INDEX ledger_account ON ledger_entries(account_id,journal_id);
CREATE TABLE review_actions (id uuid PRIMARY KEY, transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
 analyst_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL CHECK(decision IN ('approve','reject')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000), created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE idempotency_records (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), key text NOT NULL,
 request_hash text NOT NULL, resource_type text, resource_id uuid, original_status integer, UNIQUE(actor_id,key));
CREATE TABLE audit_logs (id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
 resource_type text NOT NULL, resource_id uuid NOT NULL, request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX audit_resource ON audit_logs(resource_type,resource_id,created_at,id);

CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable financial record' USING ERRCODE='23514'; END $$;
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON journals FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER evaluation_immutable BEFORE UPDATE OR DELETE ON fraud_evaluations FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER rule_immutable BEFORE UPDATE OR DELETE ON rule_versions FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE FUNCTION balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j uuid; n integer; total numeric;
BEGIN
 j := CASE WHEN TG_TABLE_NAME='journals' THEN NEW.id ELSE NEW.journal_id END;
 SELECT count(*),coalesce(sum(delta::numeric),0) INTO n,total FROM public.ledger_entries WHERE journal_id=j;
 IF n<>2 OR total<>0 THEN RAISE EXCEPTION 'unbalanced journal' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION balanced_journal();
CREATE CONSTRAINT TRIGGER entries_balanced AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION balanced_journal();

CREATE FUNCTION hold_command(cmd uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.transactions%ROWTYPE; a public.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT t FROM public.transactions WHERE id=cmd;
 IF t.status<>'pending_review' THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
 IF t.type<>'deposit' THEN
  SELECT * INTO STRICT a FROM public.accounts WHERE id=t.source_account_id FOR UPDATE;
  IF a.status<>'active' OR a.posted_balance-a.reserved_amount<t.amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO public.reservations VALUES(gen_random_uuid(),t.id,a.id,t.amount,'active',clock_timestamp(),NULL);
  UPDATE public.accounts SET reserved_amount=reserved_amount+t.amount,version=version+1 WHERE id=a.id;
 END IF;
END $$;
CREATE FUNCTION reject_command(cmd uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.transactions%ROWTYPE; r public.reservations%ROWTYPE;
BEGIN
 SELECT * INTO STRICT t FROM public.transactions WHERE id=cmd FOR UPDATE;
 IF t.status<>'pending_review' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
 SELECT * INTO r FROM public.reservations WHERE transaction_id=cmd AND state='active' FOR UPDATE;
 IF FOUND THEN
  UPDATE public.accounts SET reserved_amount=reserved_amount-r.amount,version=version+1 WHERE id=r.account_id;
  UPDATE public.reservations SET state='released',resolved_at=clock_timestamp() WHERE id=r.id;
 END IF;
 UPDATE public.transactions SET status='rejected',version=version+1 WHERE id=cmd;
END $$;
CREATE FUNCTION post_command(cmd uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
CREATE FUNCTION post_reversal(req uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.reversal_requests%ROWTYPE; t public.transactions%ROWTYPE; old_j uuid; j uuid:=gen_random_uuid(); e record; a public.accounts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT r FROM public.reversal_requests WHERE id=req;
 SELECT * INTO STRICT t FROM public.transactions WHERE id=r.original_transaction_id;
 SELECT id INTO STRICT old_j FROM public.journals WHERE transaction_id=t.id;
 PERFORM a.id FROM public.accounts a JOIN public.ledger_entries e ON e.account_id=a.id WHERE e.journal_id=old_j ORDER BY a.id FOR UPDATE OF a;
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
 UPDATE public.accounts a SET posted_balance=a.posted_balance-e.delta,version=a.version+1 FROM public.ledger_entries e WHERE e.journal_id=old_j AND e.account_id=a.id;
 UPDATE public.transactions SET status='reversed',version=version+1 WHERE id=t.id;
 UPDATE public.reversal_requests SET status='posted' WHERE id=req;
END $$;
REVOKE ALL ON FUNCTION hold_command(uuid),reject_command(uuid),post_command(uuid),post_reversal(uuid) FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
