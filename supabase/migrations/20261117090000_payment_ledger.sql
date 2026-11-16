-- =====================================================================
-- Connectly: payment ledger (Phase 1)
-- Project: plydltvxfozxflarrfrx (Connectly, eu-west-1)
--
-- Additive. No table, column or row is dropped. Existing rows keep their
-- values; new columns are nullable or defaulted.
--
-- What it adds
--   purchases   : amount_kobo, currency, router_id, paid_at, failed_at,
--                 failure_reason, provider_reference; UNIQUE + NOT NULL
--                 reference; plan/customer deletes no longer erase purchases
--   payment_events : every verified Korapay webhook, stored once
--   notifications  : every SMS, with status and retries
--   confirm_payment / mark_payment_failed : the only way a purchase changes
--                 payment state; idempotent; callable by service_role only
-- Rollback: supabase/rollbacks/20261117090000_payment_ledger.rollback.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. purchases becomes the payment ledger
-- ---------------------------------------------------------------------
alter table public.purchases
  add column if not exists amount_kobo        bigint,
  add column if not exists currency           text not null default 'NGN',
  add column if not exists router_id          uuid references public.routers(id) on delete set null,
  add column if not exists paid_at            timestamptz,
  add column if not exists failed_at          timestamptz,
  add column if not exists failure_reason     text,
  add column if not exists provider_reference text;

alter table public.purchases
  add constraint purchases_amount_kobo_positive check (amount_kobo is null or amount_kobo > 0);

-- Every lookup and every duplicate check depends on the reference.
-- (Both existing rows have distinct, non-null references.)
alter table public.purchases alter column reference set not null;
alter table public.purchases add constraint purchases_reference_key unique (reference);

create index if not exists idx_purchases_status_created on public.purchases (status, created_at desc);
create index if not exists idx_purchases_phone on public.purchases (phone_number);

-- Deleting a plan or a customer must never erase purchase history.
-- Previously both foreign keys were ON DELETE CASCADE.
alter table public.purchases drop constraint purchases_plan_id_fkey;
alter table public.purchases
  add constraint purchases_plan_id_fkey foreign key (plan_id)
  references public.plans(id) on delete restrict;

alter table public.purchases drop constraint purchases_customer_id_fkey;
alter table public.purchases
  add constraint purchases_customer_id_fkey foreign key (customer_id)
  references public.customers(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. payment_events: every signature-verified webhook, stored once
--    (identical redeliveries collapse on the payload hash)
-- ---------------------------------------------------------------------
create table if not exists public.payment_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'korapay',
  event_type     text not null,
  reference      text,
  payload_sha256 text not null,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  outcome        text,
  error          text,
  constraint payment_events_provider_payload_key unique (provider, payload_sha256)
);
create index if not exists idx_payment_events_reference on public.payment_events (reference);

-- ---------------------------------------------------------------------
-- 3. notifications: every SMS we send
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  purchase_id         uuid references public.purchases(id) on delete set null,
  channel             text not null default 'sms' check (channel in ('sms')),
  recipient           text not null,
  template            text not null,
  body                text not null,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts            integer not null default 0,
  provider_message_id text,
  last_error          text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  -- one confirmation SMS per purchase, even if the webhook arrives twice
  constraint notifications_purchase_template_key unique (purchase_id, template)
);
create index if not exists idx_notifications_status on public.notifications (status, created_at);

-- New tables: RLS on, no policies, no browser access (matches the lockdown).
alter table public.payment_events enable row level security;
alter table public.notifications  enable row level security;
revoke all on public.payment_events, public.notifications from anon;
revoke truncate, references, trigger, maintain on public.payment_events, public.notifications from authenticated;

-- ---------------------------------------------------------------------
-- 4. confirm_payment: the single, idempotent path from pending to paid
--    Called only after Korapay's signature AND its verify API agree.
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_reference          text,
  p_amount_paid_kobo   bigint,
  p_currency           text,
  p_fee_kobo           bigint default null,
  p_provider_reference text default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  p          public.purchases%rowtype;
  v_duration integer;
  v_customer uuid;
begin
  select * into p from public.purchases where reference = p_reference for update;
  if not found then
    return jsonb_build_object('outcome', 'unknown_reference');
  end if;

  if p.status = 'paid' then
    return jsonb_build_object('outcome', 'already_paid', 'purchase_id', p.id, 'expires_at', p.expires_at);
  end if;
  if p.status not in ('pending', 'failed') then
    return jsonb_build_object('outcome', 'not_payable', 'purchase_id', p.id, 'status', p.status);
  end if;
  if upper(coalesce(p_currency, '')) <> upper(p.currency) then
    return jsonb_build_object('outcome', 'currency_mismatch', 'purchase_id', p.id);
  end if;
  if p.amount_kobo is null or p_amount_paid_kobo is null or p_amount_paid_kobo < p.amount_kobo then
    return jsonb_build_object('outcome', 'amount_mismatch', 'purchase_id', p.id,
                              'expected_kobo', p.amount_kobo, 'paid_kobo', p_amount_paid_kobo);
  end if;

  select duration_seconds into v_duration from public.plans where id = p.plan_id;

  if p.phone_number is not null then
    insert into public.customers (phone_number) values (p.phone_number)
    on conflict (phone_number) do update set phone_number = excluded.phone_number
    returning id into v_customer;
  end if;

  update public.purchases set
    status             = 'paid',
    paid_at            = now(),
    failed_at          = null,
    failure_reason     = null,
    expires_at         = now() + make_interval(secs => v_duration),
    amount_paid        = p_amount_paid_kobo / 100.0,
    gateway_fee_ngn    = coalesce(p_fee_kobo, 0) / 100.0,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    customer_id        = coalesce(v_customer, customer_id)
  where id = p.id
  returning * into p;

  return jsonb_build_object('outcome', 'paid', 'purchase_id', p.id, 'expires_at', p.expires_at);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. mark_payment_failed: only a pending purchase can become failed
-- ---------------------------------------------------------------------
create or replace function public.mark_payment_failed(
  p_reference text,
  p_reason    text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  p public.purchases%rowtype;
begin
  select * into p from public.purchases where reference = p_reference for update;
  if not found then
    return jsonb_build_object('outcome', 'unknown_reference');
  end if;
  if p.status <> 'pending' then
    return jsonb_build_object('outcome', 'unchanged', 'purchase_id', p.id, 'status', p.status);
  end if;

  update public.purchases
     set status = 'failed', failed_at = now(), failure_reason = left(p_reason, 500)
   where id = p.id;

  return jsonb_build_object('outcome', 'failed', 'purchase_id', p.id);
end;
$$;

-- Only the server (service_role) may change payment state.
revoke all on function public.confirm_payment(text, bigint, text, bigint, text) from public, anon, authenticated;
revoke all on function public.mark_payment_failed(text, text)                   from public, anon, authenticated;
grant execute on function public.confirm_payment(text, bigint, text, bigint, text) to service_role;
grant execute on function public.mark_payment_failed(text, text)                   to service_role;

commit;
