-- Rollback for 20261121130000_sms_short_plans.sql: puts back claim_due_sms
-- exactly as 20261121120000_sms_queue.sql created it. No data changes.

begin;

create or replace function public.claim_due_sms(p_now timestamptz, p_limit integer)
returns table (
  notification_id uuid,
  template        text,
  purchase_id     uuid,
  recipient       text,
  reference       text,
  amount_kobo     bigint,
  expires_at      timestamptz,
  plan_name       text,
  location_name   text,
  voucher_code    text
)
language plpgsql
volatile
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'p_limit must be between 1 and 50';
  end if;

  -- A claim nobody recorded within 15 minutes: the job stopped part way.
  -- Marked failed rather than sent again, because the text may have gone out.
  update notifications n
     set status = 'failed', last_error = 'Interrupted before the result was recorded'
   where n.status = 'queued' and n.body = '' and n.created_at < p_now - interval '15 minutes';

  return query
  with due as (
    (select p.id as pid, p.phone_number as phone, 'payment_confirmed'::text as tpl, 0 as prio, p.paid_at as at
       from purchases p
      where p.status = 'paid'
        and p.phone_number is not null
        and p.paid_at >= p_now - interval '24 hours'
        and p.paid_at <  p_now - interval '2 minutes'
        and not exists (select 1 from notifications n where n.purchase_id = p.id and n.template = 'payment_confirmed'))
    union all
    (select p.id, p.phone_number, w.tpl, w.prio, p.expires_at
       from (values ('expiry_soon'::text, 1, p_now, p_now + interval '1 hour'),
                    ('expired'::text,     2, p_now - interval '1 hour', p_now)) as w(tpl, prio, lo, hi)
       join purchases p on p.status = 'paid' and p.expires_at > w.lo and p.expires_at <= w.hi
      where p.phone_number is not null
        and not exists (select 1 from notifications n where n.purchase_id = p.id and n.template = w.tpl)
        -- Revoked early: no reminder.
        and not exists (select 1 from network_authorizations g
                         where g.purchase_id = p.id and (g.revoked_at is not null or g.status = 'revoked'))
        -- Already topped up: a newer paid plan on the same phone runs past this one.
        and not exists (select 1 from purchases q
                         where q.phone_number = p.phone_number and q.status = 'paid'
                           and q.expires_at > p.expires_at and q.id <> p.id))
    order by prio, at
    limit p_limit
  ),
  claimed as (
    insert into notifications (purchase_id, recipient, template, body, created_at)
    select d.pid, d.phone, d.tpl, '', p_now from due d
    on conflict (purchase_id, template) do nothing
    returning id, notifications.purchase_id, notifications.template, notifications.recipient
  )
  select c.id, c.template, c.purchase_id, c.recipient,
         p.reference, p.amount_kobo::bigint, p.expires_at,
         pl.name::text, l.name::text,
         (select g.voucher_code from network_authorizations g where g.purchase_id = p.id limit 1)
    from claimed c
    join purchases p on p.id = c.purchase_id
    left join plans pl on pl.id = p.plan_id
    left join locations l on l.id = p.location_id
   order by case c.template when 'payment_confirmed' then 0 when 'expiry_soon' then 1 else 2 end,
            coalesce(case when c.template = 'payment_confirmed' then p.paid_at end, p.expires_at);
end;
$$;

commit;
