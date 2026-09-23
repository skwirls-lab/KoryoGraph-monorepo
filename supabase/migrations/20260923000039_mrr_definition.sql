-- 0039 One MRR definition everywhere: recurring/contract memberships that are active, past due or
-- suspended (still contracted) count; memberships on hold are paused and don't; trials never do.

create or replace view public.v_mrr with (security_invoker = true) as
  select m.tenant_id, m.id as membership_id, m.household_id, m.person_id, p.name as plan_name, p.program_ids,
         round(coalesce(m.price_override_cents, p.price_cents) *
           case p.interval when 'week' then 52.0 / 12 when 'month' then 1 when 'year' then 1.0 / 12 else 0 end / p.interval_count)::int as mrr_cents
  from public.memberships m
  join public.membership_plans p on p.id = m.plan_id
  where m.status in ('active', 'past_due', 'suspended') and p.kind in ('recurring', 'contract');

create or replace view public.v_membership_mrr as
  select m.tenant_id, m.id as membership_id, m.household_id, m.person_id, pl.name as plan_name, m.starts_at,
         coalesce(m.cancel_at,
                  case when m.status = 'expired' then coalesce(m.contract_ends_at, m.ends_at, (m.updated_at at time zone 'UTC')::date) end,
                  case when m.status = 'cancelled' then (m.updated_at at time zone 'UTC')::date end) as ended_on,
         round(coalesce(m.price_override_cents, pl.price_cents) *
           case pl.interval when 'week' then 52.0 / 12 when 'month' then 1 when 'year' then 1.0 / 12 else 0 end / pl.interval_count)::int as mrr_cents,
         case when m.status = 'on_hold' then coalesce(m.hold_from, (m.updated_at at time zone 'UTC')::date) end as paused_on
  from public.memberships m
  join public.membership_plans pl on pl.id = m.plan_id
  where pl.kind in ('recurring', 'contract') and m.status not in ('pending', 'trial');
alter view public.v_membership_mrr set (security_invoker = true);

create or replace view public.v_mrr_monthly with (security_invoker = true) as
  with months as (
    select t.id as tenant_id, gs::date as month, (gs + interval '1 month' - interval '1 day')::date as month_end
    from public.tenants t,
         generate_series(date_trunc('month', now() at time zone t.timezone) - interval '11 months', date_trunc('month', now() at time zone t.timezone), interval '1 month') gs
  )
  select mo.tenant_id, mo.month,
         coalesce(sum(s.mrr_cents) filter (where s.starts_at <= mo.month_end and (s.ended_on is null or s.ended_on > mo.month_end)
                                             and (s.paused_on is null or s.paused_on > mo.month_end)), 0)::int as mrr_cents,
         coalesce(sum(s.mrr_cents) filter (where s.starts_at between mo.month and mo.month_end), 0)::int as new_mrr_cents,
         coalesce(sum(s.mrr_cents) filter (where s.ended_on between mo.month and mo.month_end), 0)::int as churned_mrr_cents,
         count(*) filter (where s.starts_at <= mo.month_end and (s.ended_on is null or s.ended_on > mo.month_end)
                            and (s.paused_on is null or s.paused_on > mo.month_end))::int as memberships
  from months mo
  left join public.v_membership_mrr s on s.tenant_id = mo.tenant_id
  group by mo.tenant_id, mo.month;
