-- 0043 Scheduled automation triggers, evaluated in SQL (set-based) by the automations job.
--   absence {days}            active students with an active enrollment whose last class (school-local date) was
--                             ≥ days ago (or who never came and enrolled ≥ days ago) — once per absence streak
--   birthday                  students whose birthday is today — once per year
--   membership_expiring {days} memberships (active/trial) ending within `days` — once per end date
--   contract_ending {days}    contracts ending within `days` — once per end date
create or replace function public.automation_evaluate(p_tenant_id uuid, p_today date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  n int := 0;
  k int;
  days int;
  tz text := (select timezone from public.tenants where id = p_tenant_id);
begin
  for a in select * from public.automations where tenant_id = p_tenant_id and active
            and trigger ->> 'kind' in ('absence', 'birthday', 'membership_expiring', 'contract_ending') loop
    days := coalesce((a.trigger -> 'params' ->> 'days')::int, 14);
    if a.trigger ->> 'kind' = 'absence' then
      insert into public.automation_runs (tenant_id, automation_id, person_id, context, dedupe_key)
      select p_tenant_id, a.id, x.person_id, jsonb_build_object('event', 'absence', 'days', days, 'last_attended', x.last_date),
             'absence:' || days || ':' || x.person_id || ':' || coalesce(x.last_date::text, 'never')
      from (
        select p.id as person_id,
               (select max((s.starts_at at time zone tz)::date) from public.attendance at join public.class_sessions s on s.id = at.session_id
                 where at.person_id = p.id and s.starts_at <= now()) as last_date,
               (select min(e.started_at) from public.enrollments e where e.person_id = p.id and e.status = 'active') as since
        from public.people p
        where p.tenant_id = p_tenant_id and p.archived_at is null and p.status = 'active' and 'student' = any (p.type_flags)
          and exists (select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active')
      ) x
      where coalesce(x.last_date, x.since) <= p_today - days
      on conflict (automation_id, dedupe_key) do nothing;
    elsif a.trigger ->> 'kind' = 'birthday' then
      insert into public.automation_runs (tenant_id, automation_id, person_id, context, dedupe_key)
      select p_tenant_id, a.id, p.id, jsonb_build_object('event', 'birthday'), 'birthday:' || p.id || ':' || extract(year from p_today)
      from public.people p
      where p.tenant_id = p_tenant_id and p.archived_at is null and 'student' = any (p.type_flags) and p.dob is not null
        and extract(month from p.dob) = extract(month from p_today) and extract(day from p.dob) = extract(day from p_today)
      on conflict (automation_id, dedupe_key) do nothing;
    elsif a.trigger ->> 'kind' = 'membership_expiring' then
      insert into public.automation_runs (tenant_id, automation_id, person_id, context, dedupe_key)
      select p_tenant_id, a.id, m.person_id, jsonb_build_object('event', 'membership_expiring', 'membership_id', m.id, 'ends_at', m.ends_at),
             'expiring:' || m.id || ':' || m.ends_at
      from public.memberships m
      where m.tenant_id = p_tenant_id and m.status in ('active', 'trial') and m.ends_at is not null and m.ends_at between p_today and p_today + days
      on conflict (automation_id, dedupe_key) do nothing;
    else
      insert into public.automation_runs (tenant_id, automation_id, person_id, context, dedupe_key)
      select p_tenant_id, a.id, m.person_id, jsonb_build_object('event', 'contract_ending', 'membership_id', m.id, 'contract_ends_at', m.contract_ends_at),
             'contract:' || m.id || ':' || m.contract_ends_at
      from public.memberships m
      where m.tenant_id = p_tenant_id and m.status in ('active', 'past_due') and m.contract_ends_at is not null and m.contract_ends_at between p_today and p_today + days
      on conflict (automation_id, dedupe_key) do nothing;
    end if;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end;
$$;
revoke execute on function public.automation_evaluate(uuid, date) from public, anon, authenticated;
grant execute on function public.automation_evaluate(uuid, date) to service_role;
