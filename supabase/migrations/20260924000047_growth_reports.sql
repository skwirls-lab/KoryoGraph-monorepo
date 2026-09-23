-- 0047 Growth reports (F14.2): trial funnel, retention cohorts, churn list, event revenue. All views are
-- security_invoker, so each reader sees only what their permissions already allow. Months are school-local.

-- Trial funnel by the month a lead arrived and its source. A later stage implies the earlier steps (a lead
-- sitting in Offer did book and attend a trial); explicit evidence (a trial booking or activity) counts too.
create view public.v_trial_funnel with (security_invoker = true) as
  select l.tenant_id, app.local_period(l.tenant_id, l.created_at) as period, coalesce(nullif(l.source, ''), 'unknown') as source,
         count(*)::int as leads,
         count(*) filter (where l.trial_booking_id is not null or st.key in ('trial_scheduled', 'trial_attended', 'offer') or st.kind = 'won'
                            or exists (select 1 from public.lead_activities a where a.lead_id = l.id and a.kind in ('trial_booked', 'trial_attended')))::int as trials_booked,
         count(*) filter (where st.key in ('trial_attended', 'offer') or st.kind = 'won'
                            or exists (select 1 from public.lead_activities a where a.lead_id = l.id and a.kind = 'trial_attended'))::int as trials_attended,
         count(*) filter (where st.kind = 'won')::int as won,
         count(*) filter (where st.kind = 'lost')::int as lost
  from public.leads l join public.pipeline_stages st on st.id = l.stage_id
  group by l.tenant_id, app.local_period(l.tenant_id, l.created_at), coalesce(nullif(l.source, ''), 'unknown');

-- Memberships that count for retention (not trials, drop-ins or class packs), with the day they stopped.
create view public.v_membership_spans with (security_invoker = true) as
  select ms.tenant_id, ms.id, ms.person_id, ms.household_id, ms.plan_id, p.name as plan_name, ms.status, ms.starts_at,
         case when ms.status in ('cancelled', 'expired') then coalesce(ms.cancel_at, ms.ends_at, (ms.updated_at at time zone 'UTC')::date)
              else ms.ends_at end as ended_on,
         ms.cancel_reason
  from public.memberships ms join public.membership_plans p on p.id = ms.plan_id
  where p.kind in ('recurring', 'contract', 'paid_in_full') and ms.status <> 'pending';

-- Retention cohorts: people grouped by the month of their first membership; month k counts those still
-- holding a membership on the last day of that month (or today, for the current month).
create view public.v_retention_cohorts with (security_invoker = true) as
  with firsts as (
    select tenant_id, person_id, date_trunc('month', min(starts_at))::date as cohort from public.v_membership_spans group by tenant_id, person_id
  ),
  sizes as (select tenant_id, cohort, count(*)::int as cohort_size from firsts group by tenant_id, cohort),
  grid as (
    select s.tenant_id, s.cohort, s.cohort_size, k.k,
           least((s.cohort + make_interval(months => k.k + 1) - interval '1 day')::date, app.tenant_today(s.tenant_id)) as checkpoint
    from sizes s
    cross join lateral generate_series(0, ((extract(year from age(app.tenant_today(s.tenant_id), s.cohort)) * 12
                                           + extract(month from age(app.tenant_today(s.tenant_id), s.cohort)))::int)) as k(k)
  )
  select g.tenant_id, to_char(g.cohort, 'YYYY-MM') as cohort, g.k as month_index, g.cohort_size,
         (select count(*) from firsts f where f.tenant_id = g.tenant_id and f.cohort = g.cohort
            and exists (select 1 from public.v_membership_spans m where m.person_id = f.person_id and m.starts_at <= g.checkpoint
                          and (m.ended_on is null or m.ended_on > g.checkpoint)))::int as retained
  from grid g;

-- Churn list: memberships that ended by cancellation or expiry, with reason and tenure.
create view public.v_churn_list with (security_invoker = true) as
  select m.tenant_id, m.id as membership_id, m.person_id, trim(coalesce(pe.preferred_name, pe.first_name) || ' ' || pe.last_name) as person_name,
         m.household_id, m.plan_name, m.status, m.starts_at, m.ended_on,
         (extract(year from age(m.ended_on, m.starts_at)) * 12 + extract(month from age(m.ended_on, m.starts_at)))::int as tenure_months,
         coalesce(nullif(trim(m.cancel_reason), ''), case when m.status = 'expired' then 'Expired' else 'No reason given' end) as reason,
         -- Still a member through another membership?
         exists (select 1 from public.v_membership_spans o where o.person_id = m.person_id and o.id <> m.id and o.status in ('active', 'past_due', 'on_hold', 'trial')) as still_member
  from public.v_membership_spans m join public.people pe on pe.id = m.person_id
  where m.status in ('cancelled', 'expired');

-- Event revenue: registrations and their invoices (plus a party's deposit). Voided invoices don't count.
create view public.v_event_revenue with (security_invoker = true) as
  with inv as (
    select r.event_id, i.total_cents, i.balance_cents from public.event_registrations r join public.invoices i on i.id = r.invoice_id where i.status <> 'void'
    union all
    select e.id, i.total_cents, i.balance_cents from public.events e join public.invoices i on i.id = e.deposit_invoice_id where i.status <> 'void'
  )
  select e.tenant_id, e.id as event_id, e.kind, e.name, e.starts_at, e.status,
         (select count(*) from public.event_registrations r where r.event_id = e.id and r.status <> 'cancelled')::int as registrations,
         coalesce((select sum(total_cents) from inv where inv.event_id = e.id), 0)::int as invoiced_cents,
         coalesce((select sum(total_cents - balance_cents) from inv where inv.event_id = e.id), 0)::int as paid_cents,
         coalesce((select sum(balance_cents) from inv where inv.event_id = e.id), 0)::int as outstanding_cents
  from public.events e;

-- Sessions taught with the teacher's name, for the staff sessions report.
create view public.v_staff_sessions with (security_invoker = true) as
  select v.tenant_id, v.user_id, coalesce(pr.full_name, pr.email::text, 'Staff') as staff_name, v.period, v.sessions, v.hours
  from public.v_instructor_sessions v left join public.profiles pr on pr.id = v.user_id;
