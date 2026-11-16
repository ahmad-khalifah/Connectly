-- Payment ledger scenario check. Run on STAGING (never production) after the
-- payment ledger migration. It creates purchases prefixed STG2_, exercises
-- confirm_payment / mark_payment_failed, records each result, and deletes
-- everything it created. Needs the staging seed plan ...0201 (N200, 1 hour)
-- and location ...0101.
--
-- Last run on staging (ssmydcwqwytcmfhotjzs) 2026-11-16 22:25 WAT: 14/14 pass.

create temp table t_results(n int, scenario text, expected text, actual text, pass boolean);
do $$
declare
  pl uuid := '00000000-0000-4000-8000-000000000201';
  lc uuid := '00000000-0000-4000-8000-000000000101';
  ph text := '2348030009901';
  r jsonb; r2 jsonb; p purchases%rowtype; e1 timestamptz; ok boolean; err text;
begin
  insert into purchases(plan_id, location_id, reference, phone_number, amount_kobo, net_amount_ngn, payment_gateway)
  select pl, lc, 'STG2_'||s, ph, 20000, 200, 'korapay' from unnest(array['OK','UNDER','OVER','CUR','FAIL','LATE','PAIDFAIL','NULLAMT']) s;
  update purchases set amount_kobo = null where reference='STG2_NULLAMT';

  r := confirm_payment('STG2_OK', 20000, 'NGN', 150, 'KPY-STG-OK');
  select * into p from purchases where reference='STG2_OK';
  ok := r->>'outcome'='paid' and p.status='paid' and p.paid_at is not null and p.amount_paid=200 and p.gateway_fee_ngn=1.5
        and p.provider_reference='KPY-STG-OK' and p.customer_id is not null
        and abs(extract(epoch from (p.expires_at - p.paid_at)) - 3600) < 2;
  insert into t_results values (1,'Exact payment','paid; expiry = paid_at + 1h; fee, provider ref, customer linked',
    r->>'outcome'||'; status='||p.status||'; expiry-paid='||round(extract(epoch from (p.expires_at-p.paid_at)))||'s; fee='||p.gateway_fee_ngn||'; customer='||(p.customer_id is not null), ok);
  e1 := p.expires_at;

  r := confirm_payment('STG2_OK', 20000, 'NGN', 150, 'KPY-STG-OK');
  select * into p from purchases where reference='STG2_OK';
  insert into t_results values (2,'Duplicate confirmation','already_paid; expiry unchanged',
    r->>'outcome'||'; expiry unchanged='||(p.expires_at=e1), r->>'outcome'='already_paid' and p.expires_at=e1);

  r := confirm_payment('STG2_UNDER', 19900, 'NGN');
  select * into p from purchases where reference='STG2_UNDER';
  insert into t_results values (3,'Underpayment (N199 of N200)','amount_mismatch; stays pending; no expiry',
    r->>'outcome'||'; status='||p.status||'; expires_at null='||(p.expires_at is null), r->>'outcome'='amount_mismatch' and p.status='pending' and p.expires_at is null);

  r := confirm_payment('STG2_OVER', 25000, 'NGN');
  select * into p from purchases where reference='STG2_OVER';
  insert into t_results values (4,'Overpayment (N250 of N200)','paid; amount_paid records N250',
    r->>'outcome'||'; amount_paid='||p.amount_paid, r->>'outcome'='paid' and p.amount_paid=250);

  r := confirm_payment('STG2_CUR', 20000, 'USD');
  select * into p from purchases where reference='STG2_CUR';
  insert into t_results values (5,'Wrong currency (USD)','currency_mismatch; stays pending',
    r->>'outcome'||'; status='||p.status, r->>'outcome'='currency_mismatch' and p.status='pending');

  r := mark_payment_failed('STG2_FAIL', 'card declined');
  select * into p from purchases where reference='STG2_FAIL';
  insert into t_results values (6,'Failed payment','failed; failed_at and reason stored; no expiry',
    r->>'outcome'||'; status='||p.status||'; reason='||coalesce(p.failure_reason,'-'), r->>'outcome'='failed' and p.status='failed' and p.failed_at is not null and p.expires_at is null);

  perform mark_payment_failed('STG2_LATE', 'timeout');
  r := confirm_payment('STG2_LATE', 20000, 'NGN');
  select * into p from purchases where reference='STG2_LATE';
  insert into t_results values (7,'Late success after failure','paid; failure fields cleared',
    r->>'outcome'||'; status='||p.status||'; failed_at null='||(p.failed_at is null), r->>'outcome'='paid' and p.status='paid' and p.failed_at is null and p.failure_reason is null);

  perform confirm_payment('STG2_PAIDFAIL', 20000, 'NGN');
  r := mark_payment_failed('STG2_PAIDFAIL', 'late failed webhook');
  select * into p from purchases where reference='STG2_PAIDFAIL';
  insert into t_results values (8,'Late failure after paid','unchanged; stays paid',
    r->>'outcome'||'; status='||p.status, r->>'outcome'='unchanged' and p.status='paid');

  r := confirm_payment('STG2_DOES_NOT_EXIST', 20000, 'NGN');
  r2 := mark_payment_failed('STG2_DOES_NOT_EXIST', 'x');
  insert into t_results values (9,'Unknown reference','unknown_reference from both functions',
    (r->>'outcome')||' / '||(r2->>'outcome'), r->>'outcome'='unknown_reference' and r2->>'outcome'='unknown_reference');

  r := confirm_payment('STG2_NULLAMT', 20000, 'NGN');
  select * into p from purchases where reference='STG2_NULLAMT';
  insert into t_results values (10,'Purchase with no recorded amount','amount_mismatch; never auto-paid',
    r->>'outcome'||'; status='||p.status, r->>'outcome'='amount_mismatch' and p.status='pending');

  insert into t_results select 11,'Same phone, several purchases','one customer row, all paid purchases linked to it',
    count(distinct customer_id)||' customer id(s) across '||count(*)||' paid', count(distinct customer_id)=1
    from purchases where reference like 'STG2_%' and status='paid';

  insert into payment_events(provider, event_type, payload, payload_sha256) values ('korapay','charge.success','{"t":1}','stg2-sha-1');
  begin
    insert into payment_events(provider, event_type, payload, payload_sha256) values ('korapay','charge.success','{"t":1}','stg2-sha-1');
    err := 'accepted twice';
  exception when unique_violation then err := 'rejected (23505)';
  end;
  insert into t_results values (12,'Same webhook body stored twice','second insert rejected', err, err='rejected (23505)');

  select id into p.id from purchases where reference='STG2_OK';
  insert into notifications(purchase_id, template, recipient, body) values (p.id,'payment_confirmed',ph,'test');
  begin
    insert into notifications(purchase_id, template, recipient, body) values (p.id,'payment_confirmed',ph,'test');
    err := 'accepted twice';
  exception when unique_violation then err := 'rejected (23505)';
  end;
  insert into t_results values (13,'Second confirmation SMS for same purchase','second insert rejected', err, err='rejected (23505)');

  begin
    delete from plans where id = pl;
    err := 'deleted';
  exception when foreign_key_violation then err := 'blocked (23503)';
  end;
  insert into t_results values (14,'Delete a plan that has purchases','blocked by RESTRICT', err, err='blocked (23503)');

  delete from notifications where recipient = ph;
  delete from payment_events where payload_sha256 like 'stg2-%';
  delete from purchases where reference like 'STG2_%';
  delete from customers where phone_number = ph;
end $$;
select n, scenario, expected, actual, pass,
  (select count(*) from purchases where reference like 'STG2_%') leftover from t_results order by n;
