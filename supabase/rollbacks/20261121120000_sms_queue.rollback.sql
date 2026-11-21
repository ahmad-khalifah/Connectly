-- Rollback for 20261121120000_sms_queue.sql.
-- Two functions and one index: dropping them loses no data. Texts already
-- claimed or sent stay in notifications. Roll back the app first: the app
-- version before this migration does not call these functions.

begin;

drop function if exists public.record_sms_results(jsonb);
drop function if exists public.claim_due_sms(timestamptz, integer);
drop index if exists public.idx_purchases_paid_expires;

commit;
