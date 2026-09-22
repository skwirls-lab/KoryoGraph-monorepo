-- 0018 Bookings, waitlists, makeup credits (F5.4, F5.5). Race-free: the session row is locked while
-- capacity is checked. Callers: staff with attendance.write (any person), or a Home user for someone in
-- their own household. Tenant rule (settings.makeups): cancelling at least the class's cancellation window
-- before start earns a makeup credit (default on, 60-day expiry).

create or replace function app.can_book_for(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_permission('attendance.write') or p_person_id = any (app.household_person_ids());
$$;

create or replace function public.book_session(p_session_id uuid, p_person_id uuid, p_use_credit boolean default false, p_source text default null)
returns table (booking_id uuid, status text, waitlist_position int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  s public.class_sessions;
  b public.bookings;
  taken int;
  pos int;
  credit uuid;
  src text := coalesce(p_source, case when app.has_permission('attendance.write') then 'desk' else 'home' end);
begin
  if tid is null or not app.can_book_for(p_person_id) then
    raise exception 'not allowed to book for this person' using errcode = '42501';
  end if;
  select * into s from public.class_sessions where id = p_session_id and tenant_id = tid for update;
  if not found then
    raise exception 'class not found' using errcode = '22023';
  end if;
  if s.status <> 'scheduled' or s.starts_at <= now() then
    raise exception 'this class can no longer be booked' using errcode = '22023';
  end if;
  if not s.bookable and not app.has_permission('attendance.write') then
    raise exception 'this class is not open for booking' using errcode = '22023';
  end if;
  if not exists (select 1 from public.people where id = p_person_id and tenant_id = tid) then
    raise exception 'person not found' using errcode = '22023';
  end if;

  select * into b from public.bookings where session_id = s.id and person_id = p_person_id;
  if found and b.status in ('booked', 'waitlisted', 'attended') then
    return query select b.id, b.status, b.waitlist_position;
    return;
  end if;

  select count(*) into taken from public.bookings where session_id = s.id and status in ('booked', 'attended');
  if s.capacity is null or taken < s.capacity then
    if p_use_credit then
      select id into credit from public.makeup_credits
      where person_id = p_person_id and tenant_id = tid and used_booking_id is null and expires_at > now()
      order by expires_at limit 1 for update;
      if credit is null then
        raise exception 'no makeup credit available' using errcode = '22023';
      end if;
    end if;
    insert into public.bookings (tenant_id, session_id, person_id, status, booked_by_user_id, source, credit_id)
    values (tid, s.id, p_person_id, 'booked', auth.uid(), src, credit)
    on conflict (session_id, person_id) do update set status = 'booked', waitlist_position = null, cancelled_at = null,
      booked_by_user_id = excluded.booked_by_user_id, source = excluded.source, credit_id = excluded.credit_id
    returning * into b;
    if credit is not null then
      update public.makeup_credits set used_booking_id = b.id where id = credit;
    end if;
  else
    select coalesce(max(waitlist_position), 0) + 1 into pos from public.bookings where session_id = s.id and status = 'waitlisted';
    insert into public.bookings (tenant_id, session_id, person_id, status, waitlist_position, booked_by_user_id, source)
    values (tid, s.id, p_person_id, 'waitlisted', pos, auth.uid(), src)
    on conflict (session_id, person_id) do update set status = 'waitlisted', waitlist_position = excluded.waitlist_position, cancelled_at = null
    returning * into b;
  end if;
  return query select b.id, b.status, b.waitlist_position;
end;
$$;

-- Cancel; returns whether a credit was earned and who (if anyone) was promoted off the waitlist.
create or replace function public.cancel_booking(p_booking_id uuid)
returns table (credit_id uuid, promoted_person_id uuid, promoted_booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  b public.bookings;
  s public.class_sessions;
  staff boolean := app.has_permission('attendance.write');
  rules jsonb;
  credit uuid;
  nxt public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id and tenant_id = tid;
  if not found or not app.can_book_for(b.person_id) then
    raise exception 'booking not found' using errcode = '42501';
  end if;
  select * into s from public.class_sessions where id = b.session_id for update;
  if b.status not in ('booked', 'waitlisted') then
    raise exception 'this booking is already %', b.status using errcode = '22023';
  end if;
  if not staff and s.starts_at - make_interval(mins => s.cancellation_window_min) < now() then
    raise exception 'too late to cancel online — please contact the school' using errcode = '22023';
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now(), waitlist_position = null where id = b.id;

  -- Makeup credit for a timely cancellation of a confirmed spot (tenant rule).
  select coalesce(settings -> 'makeups', '{}'::jsonb) into rules from public.tenants where id = tid;
  if b.status = 'booked' and coalesce((rules ->> 'enabled')::boolean, true)
     and s.starts_at - make_interval(mins => s.cancellation_window_min) >= now() then
    insert into public.makeup_credits (tenant_id, person_id, earned_from_session_id, reason, expires_at)
    values (tid, b.person_id, s.id, 'cancelled in time', now() + make_interval(days => coalesce((rules ->> 'expires_days')::int, 60)))
    returning id into credit;
  end if;
  -- A credit used for this booking goes back to the person.
  if b.credit_id is not null then
    update public.makeup_credits set used_booking_id = null where id = b.credit_id;
  end if;

  -- Promote the first waitlisted person into the freed spot.
  if b.status = 'booked' then
    select * into nxt from public.bookings where session_id = s.id and status = 'waitlisted' order by waitlist_position limit 1 for update;
    if found then
      update public.bookings set status = 'booked', waitlist_position = null where id = nxt.id;
      update public.bookings set waitlist_position = waitlist_position - 1 where session_id = s.id and status = 'waitlisted';
    end if;
  elsif b.status = 'waitlisted' then
    update public.bookings set waitlist_position = waitlist_position - 1
    where session_id = s.id and status = 'waitlisted' and waitlist_position > b.waitlist_position;
  end if;

  return query select credit, nxt.person_id, nxt.id;
end;
$$;

revoke execute on function app.can_book_for(uuid) from public, anon;
grant execute on function app.can_book_for(uuid) to authenticated;
revoke execute on function public.book_session(uuid, uuid, boolean, text), public.cancel_booking(uuid) from public, anon;
grant execute on function public.book_session(uuid, uuid, boolean, text), public.cancel_booking(uuid) to authenticated;

-- Spots taken in a session (a count only — members need it for availability, RLS hides others' bookings).
create or replace function public.session_taken(p_session_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.bookings b
  join public.class_sessions s on s.id = b.session_id
  where b.session_id = p_session_id and b.status in ('booked', 'attended') and s.tenant_id = app.tenant_id();
$$;
revoke execute on function public.session_taken(uuid) from public, anon;
grant execute on function public.session_taken(uuid) to authenticated;

-- Upcoming classes (next 21 days) for a person's active programs, with their booking state.
create view public.v_upcoming_for_person with (security_invoker = true) as
  select p.id as person_id, s.id as session_id, s.tenant_id, s.name, s.starts_at, s.ends_at, s.status, s.capacity, s.bookable,
         s.cancellation_window_min, s.location_id,
         b.id as booking_id, b.status as booking_status, b.waitlist_position,
         public.session_taken(s.id) as taken
  from public.people p
  join public.class_sessions s on s.tenant_id = p.tenant_id and s.starts_at > now() and s.starts_at < now() + interval '21 days'
  left join public.bookings b on b.session_id = s.id and b.person_id = p.id and b.status <> 'cancelled'
  where exists (select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active' and e.program_id = any (s.program_ids));
