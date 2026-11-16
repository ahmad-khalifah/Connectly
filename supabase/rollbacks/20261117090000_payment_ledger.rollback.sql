-- =====================================================================
-- ROLLBACK for 20261117090000_payment_ledger.sql
--
-- WARNING: this DELETES the payment_events and notifications tables and
-- the new purchases columns, with their data. Export them first if any
-- real payments have been recorded:
--   select * from public.payment_events;
--   select * from public.notifications;
--   select id, reference, amount_kobo, currency, router_id, paid_at,
--          failed_at, failure_reason, provider_reference from public.purchases;
-- =====================================================================

begin;

drop function if exists public.mark_payment_failed(text, text);
drop function if exists public.confirm_payment(text, bigint, text, bigint, text);

drop table if exists public.notifications;
drop table if exists public.payment_events;

-- restore the original (cascading) foreign keys
alter table public.purchases drop constraint purchases_customer_id_fkey;
alter table public.purchases
  add constraint purchases_customer_id_fkey foreign key (customer_id)
  references public.customers(id) on delete cascade;

alter table public.purchases drop constraint purchases_plan_id_fkey;
alter table public.purchases
  add constraint purchases_plan_id_fkey foreign key (plan_id)
  references public.plans(id) on delete cascade;

drop index if exists public.idx_purchases_phone;
drop index if exists public.idx_purchases_status_created;

alter table public.purchases drop constraint purchases_reference_key;
alter table public.purchases alter column reference drop not null;
alter table public.purchases drop constraint purchases_amount_kobo_positive;

alter table public.purchases
  drop column if exists provider_reference,
  drop column if exists failure_reason,
  drop column if exists failed_at,
  drop column if exists paid_at,
  drop column if exists router_id,
  drop column if exists currency,
  drop column if exists amount_kobo;

commit;
