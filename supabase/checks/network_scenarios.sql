-- Network Management scenario check. Run on STAGING (never production) after
-- 20261118090000_network_management. Creates a test router and purchases
-- prefixed NETCHK_, exercises the payment -> grant -> job path and the job
-- queue (the controller's rights are checked with has_*_privilege), records
-- each result, and deletes everything it created. Needs the staging seed
-- plan ...0201 (N200, 1 hour) and location ...0101.

create temp table t_net(n int, scenario text, expected text, actual text, pass boolean);
do $$
declare
  pl uuid := '00000000-0000-4000-8000-000000000201';
  lc uuid := '00000000-0000-4000-8000-000000000101';
  ph text := '2348030009902';
  r1 public.routers%rowtype; r2 public.routers%rowtype;
  p public.purchases%rowtype; g public.network_authorizations%rowtype;
  j public.controller_jobs%rowtype; o jsonb; n int; err text;
begin
  -- 1 router registration: tunnel address assigned, defaults honest
  insert into routers (location_id, identifier, name, wg_public_key, credential_ciphertext, credential_key_id)
  values (lc, 'NETCHK-R1', 'Check router 1', repeat('a', 42) || 'A=', 'ct', 'k1') returning * into r1;
  insert into routers (location_id, identifier, name, connection_method)
  values (lc, 'NETCHK-R2', 'Check router 2', 'direct_https') returning * into r2;
  insert into t_net values (1, 'Register routers', 'WireGuard router gets a 10.77.x tunnel address; direct HTTPS gets none; both Registered + Offline',
    host(r1.tunnel_ip) || ' / ' || coalesce(host(r2.tunnel_ip), 'none') || ' / ' || r1.lifecycle_status || ' ' || r1.status,
    r1.tunnel_ip << '10.77.0.0/22'::cidr and r1.tunnel_ip <> '10.77.0.1' and r2.tunnel_ip is null
      and r1.lifecycle_status = 'registered' and r1.status = 'offline');

  -- 2 activation needs a stored credential
  begin
    update routers set lifecycle_status = 'active', credential_ciphertext = null where id = r2.id;
    err := 'allowed';
  exception when check_violation then err := 'refused';
  end;
  update routers set lifecycle_status = 'active', activated_at = now() where id = r1.id;
  insert into t_net values (2, 'Activate without a credential', 'refused; with a credential allowed', err, err = 'refused');

  -- 3 paid purchase on the router -> one device, one grant, one provision job
  insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
  values (pl, lc, r1.id, 'NETCHK_PAID', ph, 'aa:bb:cc:00:99:01', 20000, 200, 'korapay');
  o := confirm_payment('NETCHK_PAID', 20000, 'NGN');
  select * into p from purchases where reference = 'NETCHK_PAID';
  select * into g from network_authorizations where purchase_id = p.id;
  select * into j from controller_jobs where authorization_id = g.id;
  insert into t_net values (3, 'Payment on a router', 'paid; 1 grant (voucher, pending_device, same expiry, device linked); 1 provision job',
    o->>'outcome' || '; grant ' || coalesce(g.voucher_code, '-') || ' ' || coalesce(g.status::text, '-') || '; job ' || coalesce(j.kind, '-') || ' ' || coalesce(j.status, '-'),
    o->>'outcome' = 'paid' and g.voucher_code ~ '^[A-HJ-NP-Z2-9]{8}$' and g.status = 'pending_device'
      and g.expires_at = p.expires_at and g.device_id is not null and j.kind = 'access.provision' and j.status = 'queued');

  -- 4 duplicate confirmation: nothing new
  o := confirm_payment('NETCHK_PAID', 20000, 'NGN');
  select count(*) into n from controller_jobs where authorization_id = g.id;
  insert into t_net values (4, 'Duplicate payment notification', 'already_paid; still 1 grant and 1 job',
    o->>'outcome' || '; grants ' || (select count(*) from network_authorizations where purchase_id = p.id) || ', jobs ' || n,
    o->>'outcome' = 'already_paid' and n = 1 and (select count(*) from network_authorizations where purchase_id = p.id) = 1);

  -- 5 failed and underpaid purchases get nothing
  insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
  values (pl, lc, r1.id, 'NETCHK_FAIL', ph, 'aa:bb:cc:00:99:02', 20000, 200, 'korapay'),
         (pl, lc, r1.id, 'NETCHK_UNDER', ph, 'aa:bb:cc:00:99:03', 20000, 200, 'korapay');
  perform mark_payment_failed('NETCHK_FAIL', 'declined');
  perform confirm_payment('NETCHK_UNDER', 100, 'NGN');
  select count(*) into n from network_authorizations a join purchases q on q.id = a.purchase_id where q.reference in ('NETCHK_FAIL', 'NETCHK_UNDER');
  insert into t_net values (5, 'Failed and underpaid payments', 'no grant, no job', n || ' grants', n = 0);

  -- 6-8 the controller's side. The job functions behave the same whoever
  -- calls them; the controller's own rights are checked with has_*_privilege
  -- because Supabase's SQL user may not SET ROLE to connectly_controller.
  select * into j from claim_next_job('netchk-worker');
  insert into t_net values (6, 'Controller claims the job', 'access.provision, running, attempt 1',
    coalesce(j.kind, '-') || ' ' || coalesce(j.status, '-') || ' ' || coalesce(j.attempts::text, '-'),
    j.kind = 'access.provision' and j.status = 'running' and j.attempts = 1);

  update network_authorizations set status = 'active', provisioned_at = now(), last_router_response = '{"ok":true}' where id = g.id;
  o := complete_job(j.id, 'netchk-worker', true, '{"hotspot_user":"created"}'::jsonb);
  select * into g from network_authorizations where id = g.id;
  insert into t_net values (7, 'Controller completes the job', 'succeeded; grant active; a second completion is refused',
    (o->>'outcome') || '; grant ' || g.status || '; again: ' || (complete_job(j.id, 'netchk-worker', true)->>'outcome'),
    o->>'outcome' = 'succeeded' and g.status = 'active' and complete_job(j.id, 'netchk-worker', true)->>'outcome' = 'not_owner');

  insert into t_net select 8, 'Controller rights', 'can: claim, complete, read credential, set grant status; cannot: phone, price, customers, payments, activate router',
    concat_ws(' ',
      has_function_privilege('connectly_controller', 'public.claim_next_job(text)', 'execute'),
      has_function_privilege('connectly_controller', 'public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer)', 'execute'),
      has_column_privilege('connectly_controller', 'public.routers', 'credential_ciphertext', 'select'),
      has_column_privilege('connectly_controller', 'public.network_authorizations', 'status', 'update'),
      '|',
      has_column_privilege('connectly_controller', 'public.purchases', 'phone_number', 'select'),
      has_column_privilege('connectly_controller', 'public.plans', 'price_kobo', 'select'),
      has_table_privilege('connectly_controller', 'public.customers', 'select'),
      has_table_privilege('connectly_controller', 'public.payment_events', 'select'),
      has_column_privilege('connectly_controller', 'public.routers', 'lifecycle_status', 'update'),
      has_function_privilege('connectly_controller', 'public.confirm_payment(text, bigint, text, bigint, text)', 'execute')),
    has_function_privilege('connectly_controller', 'public.claim_next_job(text)', 'execute')
      and has_function_privilege('connectly_controller', 'public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer)', 'execute')
      and has_column_privilege('connectly_controller', 'public.routers', 'credential_ciphertext', 'select')
      and has_column_privilege('connectly_controller', 'public.network_authorizations', 'status', 'update')
      and not has_column_privilege('connectly_controller', 'public.purchases', 'phone_number', 'select')
      and not has_column_privilege('connectly_controller', 'public.plans', 'price_kobo', 'select')
      and not has_table_privilege('connectly_controller', 'public.customers', 'select')
      and not has_table_privilege('connectly_controller', 'public.payment_events', 'select')
      and not has_column_privilege('connectly_controller', 'public.routers', 'lifecycle_status', 'update')
      and not has_function_privilege('connectly_controller', 'public.confirm_payment(text, bigint, text, bigint, text)', 'execute');

  -- 9 expiry -> exactly one revoke job, however often it runs
  update network_authorizations set expires_at = now() - interval '1 second' where id = g.id;
  n := enqueue_expired_revocations();
  n := n * 10 + enqueue_expired_revocations();
  insert into t_net values (9, 'Expiry', 'first run queues 1 revoke, second run 0', n::text, n = 10);

  -- 10 browser roles see none of it
  set local role authenticated;
  select count(*) into n from controller_jobs;
  reset role;
  begin
    set local role anon;
    perform 1 from network_settings;
    err := 'readable';
  exception when insufficient_privilege then err := 'refused';
  end;
  reset role;
  insert into t_net values (10, 'Browser roles', 'signed-in sees 0 jobs; anonymous refused', n || ' / ' || err, n = 0 and err = 'refused');

  -- cleanup, in dependency order
  delete from controller_jobs where router_id in (r1.id, r2.id);
  delete from network_authorizations where router_id in (r1.id, r2.id);
  delete from devices where mac_address::text like 'aa:bb:cc:00:99:%';
  delete from purchases where reference like 'NETCHK_%';
  delete from customers where phone_number = ph;
  delete from routers where id in (r1.id, r2.id);
end $$;
select n, scenario, expected, actual, pass,
  (select count(*) from routers where identifier like 'NETCHK-%') + (select count(*) from purchases where reference like 'NETCHK_%') leftover
from t_net order by n;
