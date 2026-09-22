-- 0027 Compare this week to the same point last week (a partial week against a full one misleads).
drop view public.v_owner_dashboard;
create view public.v_owner_dashboard with (security_invoker = true) as
  with t as (
    select id, timezone, (date_trunc('week', now() at time zone timezone)) at time zone timezone as week_start
    from public.tenants
  )
  select t.id as tenant_id,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'active' and 'student' = any (p.type_flags) and p.archived_at is null)::int as active_students,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'trial' and p.archived_at is null)::int as trials,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'lead' and p.archived_at is null)::int as leads,
    (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
       where a.tenant_id = t.id and s.starts_at >= t.week_start and s.starts_at < t.week_start + interval '7 days')::int as attendance_this_week,
    (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
       where a.tenant_id = t.id and s.starts_at >= t.week_start - interval '7 days' and s.starts_at < t.week_start)::int as attendance_last_week,
    (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
       where a.tenant_id = t.id and s.starts_at >= t.week_start - interval '7 days' and s.starts_at < now() - interval '7 days')::int as attendance_last_week_to_date,
    (select count(*) from public.class_sessions s where s.tenant_id = t.id and s.status = 'scheduled'
       and s.starts_at >= (date_trunc('day', now() at time zone t.timezone)) at time zone t.timezone
       and s.starts_at < (date_trunc('day', now() at time zone t.timezone) + interval '1 day') at time zone t.timezone)::int as classes_today,
    (select count(*) from public.v_required_documents r where r.tenant_id = t.id and r.signature_id is null)::int as unsigned_documents,
    (select count(*) from public.message_threads m where m.tenant_id = t.id and m.status = 'open' and m.unread_staff > 0)::int as unread_threads
  from t;
