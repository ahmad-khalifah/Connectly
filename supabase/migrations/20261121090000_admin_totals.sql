-- =====================================================================
-- Connectly: admin totals computed in the database
-- Project: plydltvxfozxflarrfrx (Connectly, eu-west-1); staging first.
--
-- Additive. No table, column or row is changed or dropped.
--
-- Why: the admin dashboard, revenue, plans, location and customers pages
-- downloaded every paid purchase on each visit and added them up in the
-- app. That grows Supabase egress and server CPU with history, which the
-- free plans cannot afford. These functions return only the figures.
--
-- What it adds (read-only functions, callable by service_role only)
--   lagos_day(ts)          : the Lagos calendar day (UTC+1) of a timestamp
--   admin_paid_totals      : paid payments, revenue, Korapay fees and failed
--                            payments in a period, grouped by day or month,
--                            location and/or plan
--   admin_grant_counts     : plans running, customers on a plan, plans ended,
--                            plans ended early
--   admin_customer_counts  : registered and new customers
--   admin_customer_page    : one page of the customers list, by phone number
--   idx_purchases_paid_at  : index for paid purchases by payment time
--
-- Definitions match lib/admin/metrics.ts (reference implementations there,
-- checked against these functions in supabase/tests/admin_totals.test.mjs).
-- The daily-totals table for the 10-week retention rule comes in a later
-- migration; these functions keep their signatures when it does.
-- Rollback: supabase/rollbacks/20261121090000_admin_totals.rollback.sql
-- =====================================================================

begin;

create or replace function public.lagos_day(ts timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$ select ((ts at time zone 'UTC') + interval '1 hour')::date $$;

create index if not exists idx_purchases_paid_at on public.purchases (paid_at) where status = 'paid';

-- Paid purchases count on their payment time (paid_at, else created_at);
-- failed purchases on their creation time. Bounds are inclusive; a null
-- p_from means all time. p_unit: 'day' (YYYY-MM-DD), 'month' (YYYY-MM) or
-- 'none' (bucket is null).
create or replace function public.admin_paid_totals(
  p_from        timestamptz,
  p_to          timestamptz,
  p_location    uuid    default null,
  p_unit        text    default 'none',
  p_by_location boolean default false,
  p_by_plan     boolean default false
)
returns table (
  bucket      text,
  location_id uuid,
  plan_id     uuid,
  payments    bigint,
  revenue     numeric,
  fees        numeric,
  failed      bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with ev as (
    select coalesce(p.paid_at, p.created_at)                     as at,
           p.location_id, p.plan_id,
           1                                                     as paid,
           0                                                     as fail,
           coalesce(p.amount_paid, p.amount_kobo / 100.0, 0)     as amount,
           coalesce(p.gateway_fee_ngn, 0)                        as fee
      from public.purchases p
     where p.status = 'paid'
       and (p_from is null or coalesce(p.paid_at, p.created_at) >= p_from)
       and coalesce(p.paid_at, p.created_at) <= p_to
       and (p_location is null or p.location_id = p_location)
    union all
    select p.created_at, p.location_id, p.plan_id, 0, 1, 0, 0
      from public.purchases p
     where p.status = 'failed'
       and (p_from is null or p.created_at >= p_from)
       and p.created_at <= p_to
       and (p_location is null or p.location_id = p_location)
  )
  select case p_unit
           when 'day'   then to_char(public.lagos_day(ev.at), 'YYYY-MM-DD')
           when 'month' then to_char(public.lagos_day(ev.at), 'YYYY-MM')
         end,
         case when p_by_location then ev.location_id end,
         case when p_by_plan     then ev.plan_id     end,
         sum(ev.paid)::bigint,
         round(sum(ev.amount), 2),
         round(sum(ev.fee), 2),
         sum(ev.fail)::bigint
    from ev
   group by 1, 2, 3
   order by 1 nulls first, 2 nulls first, 3 nulls first
$$;

-- A grant's location is its router's location.
create or replace function public.admin_grant_counts(
  p_from     timestamptz,
  p_to       timestamptz,
  p_now      timestamptz,
  p_location uuid default null
)
returns table (
  running            bigint,
  customers_on_plans bigint,
  ended              bigint,
  ended_early        bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with g as (
    select a.status, a.expires_at, a.revoked_at, a.revoke_reason, p.phone_number
      from public.network_authorizations a
      left join public.routers   r on r.id = a.router_id
      left join public.purchases p on p.id = a.purchase_id
     where p_location is null or r.location_id = p_location
  )
  select count(*) filter (where g.status in ('active', 'pending_device') and g.expires_at > p_now),
         count(distinct g.phone_number) filter (where g.status in ('active', 'pending_device') and g.expires_at > p_now),
         count(*) filter (where g.status <> 'revoked' and g.expires_at <= p_now
                            and (p_from is null or g.expires_at >= p_from) and g.expires_at <= p_to),
         count(*) filter (where g.status = 'revoked' and g.revoke_reason is distinct from 'expired'
                            and g.revoked_at is not null
                            and (p_from is null or g.revoked_at >= p_from) and g.revoked_at <= p_to)
    from g
$$;

create or replace function public.admin_customer_counts(p_from timestamptz, p_to timestamptz)
returns table (registered bigint, new_customers bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select count(*),
         count(*) filter (where c.created_at is not null
                            and (p_from is null or c.created_at >= p_from) and c.created_at <= p_to)
    from public.customers c
$$;

-- Customers by phone number, newest purchase first. The latest paid purchase
-- decides the plan, location, end time and status; access revoked early
-- counts as ended. p_search matches anywhere in the stored phone number.
create or replace function public.admin_customer_page(
  p_search text,
  p_limit  integer,
  p_offset integer,
  p_now    timestamptz
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with paid as (
    select p.id, p.customer_id, p.plan_id, p.location_id, p.expires_at, p.created_at,
           coalesce(p.phone_number, 'Unknown') as phone,
           coalesce(p.amount_paid, p.amount_kobo / 100.0, 0) as amount,
           row_number() over (partition by coalesce(p.phone_number, 'Unknown') order by p.created_at desc, p.id desc) as rn
      from public.purchases p
     where p.status = 'paid'
  ),
  per_phone as (
    select phone,
           count(*)    as purchases,
           sum(amount) as spent,
           (array_agg(customer_id order by created_at desc, id desc) filter (where customer_id is not null))[1] as customer_id
      from paid
     group by phone
  ),
  listed as (
    select l.id as latest_id, pp.customer_id, l.phone, pp.purchases, pp.spent,
           coalesce(pl.name, 'Unknown plan') as plan_name,
           coalesce(lo.name, '—')            as location_name,
           l.expires_at                      as ends,
           coalesce(l.expires_at > p_now, false)
             and not coalesce((select bool_and(a.revoked_at is not null or a.status = 'revoked')
                                 from public.network_authorizations a where a.purchase_id = l.id), false) as running,
           l.created_at
      from paid l
      join per_phone pp on pp.phone = l.phone
      left join public.plans pl     on pl.id = l.plan_id
      left join public.locations lo on lo.id = l.location_id
     where l.rn = 1
       and (coalesce(p_search, '') = '' or strpos(l.phone, p_search) > 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from listed),
    'rows',  coalesce((
      select jsonb_agg(to_jsonb(x) - 'created_at' order by x.created_at desc, x.latest_id desc)
        from (select * from listed order by created_at desc, latest_id desc
               limit greatest(p_limit, 0) offset greatest(p_offset, 0)) x
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.lagos_day(timestamptz)                                          from public, anon, authenticated;
revoke all on function public.admin_paid_totals(timestamptz, timestamptz, uuid, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.admin_grant_counts(timestamptz, timestamptz, timestamptz, uuid)  from public, anon, authenticated;
revoke all on function public.admin_customer_counts(timestamptz, timestamptz)                 from public, anon, authenticated;
revoke all on function public.admin_customer_page(text, integer, integer, timestamptz)        from public, anon, authenticated;
grant execute on function public.lagos_day(timestamptz)                                          to service_role;
grant execute on function public.admin_paid_totals(timestamptz, timestamptz, uuid, text, boolean, boolean) to service_role;
grant execute on function public.admin_grant_counts(timestamptz, timestamptz, timestamptz, uuid)  to service_role;
grant execute on function public.admin_customer_counts(timestamptz, timestamptz)                 to service_role;
grant execute on function public.admin_customer_page(text, integer, integer, timestamptz)        to service_role;

commit;
