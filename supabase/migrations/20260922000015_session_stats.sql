-- 0015 Per-session counts for the week view and rosters (no N+1).
create view public.v_session_stats with (security_invoker = true) as
  select s.id as session_id, s.tenant_id,
         (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked', 'attended'))::int as booked,
         (select count(*) from public.bookings b where b.session_id = s.id and b.status = 'waitlisted')::int as waitlisted,
         (select count(*) from public.attendance a where a.session_id = s.id)::int as attended
  from public.class_sessions s;
