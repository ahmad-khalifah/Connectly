-- Rollback for 20261121090000_admin_totals.sql.
-- Read-only functions and one index: dropping them loses no data. The app
-- version before this migration does not call them.

begin;

drop function if exists public.admin_customer_page(text, integer, integer, timestamptz);
drop function if exists public.admin_customer_counts(timestamptz, timestamptz);
drop function if exists public.admin_grant_counts(timestamptz, timestamptz, timestamptz, uuid);
drop function if exists public.admin_paid_totals(timestamptz, timestamptz, uuid, text, boolean, boolean);
drop function if exists public.lagos_day(timestamptz);
drop index if exists public.idx_purchases_paid_at;

commit;
