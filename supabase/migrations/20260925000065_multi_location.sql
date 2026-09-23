-- 0065 Multi-location (M5.06). Staff can be limited to some locations (tenant_users.location_ids; null or
-- empty = all). The limit is enforced in RLS with a restrictive policy on every location-scoped table, so it
-- holds for every query path. Rows without a location (school-wide holidays, tax rates, events) stay visible.

create or replace function app.location_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(tu.location_ids, '{}')
  from public.tenant_users tu
  where tu.user_id = auth.uid() and tu.tenant_id = app.tenant_id() and tu.status = 'active'
  limit 1;
$$;
grant execute on function app.location_ids() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['afterschool_programs', 'cash_drawers', 'class_sessions', 'class_templates', 'events', 'holidays', 'inventory_levels',
    'inventory_movements', 'kiosk_devices', 'pos_sales', 'private_lesson_slots', 'purchase_orders', 'shifts', 'tax_rates', 'terminal_readers',
    'testing_events', 'time_entries'] loop
    execute format($p$create policy %1$s_location_scope on public.%1$s as restrictive for all to authenticated
      using ((select app.location_ids()) is null or location_id is null or location_id = any ((select app.location_ids())::uuid[]))
      with check ((select app.location_ids()) is null or location_id is null or location_id = any ((select app.location_ids())::uuid[]))$p$, t);
  end loop;
end $$;

-- Attendance and bookings follow their session's location.
create policy attendance_location_scope on public.attendance as restrictive for all to authenticated
  using ((select app.location_ids()) is null or exists (select 1 from public.class_sessions s where s.id = attendance.session_id))
  with check ((select app.location_ids()) is null or exists (select 1 from public.class_sessions s where s.id = attendance.session_id));
create policy bookings_location_scope on public.bookings as restrictive for all to authenticated
  using ((select app.location_ids()) is null or exists (select 1 from public.class_sessions s where s.id = bookings.session_id))
  with check ((select app.location_ids()) is null or exists (select 1 from public.class_sessions s where s.id = bookings.session_id));

-- Assign a staff member's locations (null = all). Owners always see every location.
create or replace function public.set_staff_locations(p_user_id uuid, p_location_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
begin
  if tid is null or not app.has_permission('staff.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenant_users tu join public.roles r on r.id = tu.role_id where tu.tenant_id = tid and tu.user_id = p_user_id and r.key = 'owner')
     and coalesce(cardinality(p_location_ids), 0) > 0 then
    raise exception 'owners always see every location' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_location_ids, '{}')) l where not exists (select 1 from public.locations where id = l and tenant_id = tid and archived_at is null)) then
    raise exception 'unknown location' using errcode = '22023';
  end if;
  update public.tenant_users set location_ids = nullif(p_location_ids, '{}') where tenant_id = tid and user_id = p_user_id;
  if not found then
    raise exception 'not a member of this school' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_staff_locations(uuid, uuid[]) from public, anon;
grant execute on function public.set_staff_locations(uuid, uuid[]) to authenticated;

-- Dashboard rollup per location (security invoker: a location-limited user sees only their own rows).
create or replace function public.location_rollup()
returns table (location_id uuid, location_name text, active_students int, classes_today int, attendance_this_week int)
language sql
stable
security invoker
set search_path = ''
as $$
  with t as (select timezone from public.tenants where id = app.tenant_id()),
  d as (select (now() at time zone (select timezone from t))::date as today)
  select l.id, l.name,
    (select count(*)::int from public.people p where p.primary_location_id = l.id and p.status = 'active' and 'student' = any (p.type_flags) and p.archived_at is null),
    (select count(*)::int from public.class_sessions s where s.location_id = l.id and s.status <> 'cancelled' and s.occurrence_date = (select today from d)),
    (select count(*)::int from public.attendance a join public.class_sessions s on s.id = a.session_id
      where s.location_id = l.id and (a.checked_in_at at time zone (select timezone from t))::date >= date_trunc('week', (select today from d))::date)
  from public.locations l
  where l.tenant_id = app.tenant_id() and l.archived_at is null
    and ((select app.location_ids()) is null or l.id = any ((select app.location_ids())::uuid[]))
  order by l.is_default desc, l.name;
$$;
grant execute on function public.location_rollup() to authenticated;

-- Attendance by class, now also by location (for the reports' location filter / rollup).
create or replace view public.v_attendance_by_class with (security_invoker = true) as
  select s.tenant_id, (date_trunc('week', s.starts_at at time zone tn.timezone))::date as week_start, s.name as class_name,
         count(distinct s.id)::int as sessions, count(a.id)::int as attendances, s.location_id
  from public.class_sessions s
  join public.tenants tn on tn.id = s.tenant_id
  left join public.attendance a on a.session_id = s.id
  where s.status <> 'cancelled'
  group by s.tenant_id, (date_trunc('week', s.starts_at at time zone tn.timezone))::date, s.name, s.location_id;
