-- 0016 v_class_roster: one-off sessions (no template) still list students enrolled in their programs.
create or replace view public.v_class_roster with (security_invoker = true) as
  with eligible as (
    select s.id as session_id, p.id as person_id, e.id as enrollment_id
    from public.class_sessions s
    left join public.class_templates t on t.id = s.template_id
    join public.enrollments e on e.program_id = any (s.program_ids) and e.status = 'active'
    join public.people p on p.id = e.person_id and p.status in ('active', 'trial') and p.archived_at is null
    left join public.ranks r on r.id = e.current_rank_id
    where (t.rank_min_position is null or coalesce(r.position, 1) >= t.rank_min_position)
      and (t.rank_max_position is null or coalesce(r.position, 1) <= t.rank_max_position)
      and (t.age_min is null or p.dob is null or extract(year from age(s.starts_at::date, p.dob)) >= t.age_min)
      and (t.age_max is null or p.dob is null or extract(year from age(s.starts_at::date, p.dob)) <= t.age_max)
  ),
  extra as (
    select b.session_id, b.person_id, null::uuid as enrollment_id from public.bookings b where b.status <> 'cancelled'
    union
    select a.session_id, a.person_id, null::uuid from public.attendance a
  ),
  roster as (
    select session_id, person_id, max(enrollment_id::text)::uuid as enrollment_id
    from (select * from eligible union all select * from extra) u
    group by session_id, person_id
  )
  select ro.session_id, s.tenant_id, ro.person_id,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as display_name,
         p.first_name, p.last_name, p.photo_path, p.dob, p.allergies, p.injury_flags, p.status as person_status,
         coalesce(ro.enrollment_id, (select e2.id from public.enrollments e2 where e2.person_id = ro.person_id and e2.program_id = any (s.program_ids) limit 1)) as enrollment_id,
         r.name as rank_name, r.belt_color, e.stripes, r.stripes_max,
         b.status as booking_status, b.waitlist_position,
         a.id is not null as attended, a.checked_in_at, a.source as attendance_source,
         (ro.enrollment_id is null) as is_extra
  from roster ro
  join public.class_sessions s on s.id = ro.session_id
  join public.people p on p.id = ro.person_id
  left join public.enrollments e on e.id = coalesce(ro.enrollment_id, (select e2.id from public.enrollments e2 where e2.person_id = ro.person_id and e2.program_id = any (s.program_ids) limit 1))
  left join public.ranks r on r.id = e.current_rank_id
  left join public.bookings b on b.session_id = ro.session_id and b.person_id = ro.person_id
  left join public.attendance a on a.session_id = ro.session_id and a.person_id = ro.person_id;

