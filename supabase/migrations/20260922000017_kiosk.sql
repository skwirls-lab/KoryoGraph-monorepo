-- 0017 Kiosk (F5.3, M1.09). A paired tablet holds a random device token (httpOnly cookie); only its
-- SHA-256 is stored. Every kiosk operation is a security-definer RPC that re-validates the token and acts
-- strictly inside that device's tenant and location. Household PINs gate check-in: 5 wrong PINs lock the
-- household for 15 minutes. No service role, no user session on the device.

create or replace function app.kiosk_device(p_token text)
returns public.kiosk_devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid kiosk token' using errcode = '42501';
  end if;
  select * into d from public.kiosk_devices
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and revoked_at is null;
  if not found then
    raise exception 'kiosk not paired' using errcode = '42501';
  end if;
  update public.kiosk_devices set last_seen_at = now() where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  return d;
end;
$$;

create or replace function public.kiosk_info(p_token text)
returns table (device_name text, tenant_name text, location_name text, confirm_mode text, time_zone text)
language sql
security definer
set search_path = ''
as $$
  select d.name, t.name, l.name, coalesce(d.settings ->> 'confirm', 'pin'), coalesce(l.timezone, t.timezone)
  from (select (app.kiosk_device(p_token)).*) d
  join public.tenants t on t.id = d.tenant_id
  join public.locations l on l.id = d.location_id;
$$;

-- Name search (≥ 2 characters): active/trial students of the device's tenant. Minimal fields only.
create or replace function public.kiosk_search(p_token text, p_q text)
returns table (person_id uuid, display_name text, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  q text := lower(trim(coalesce(p_q, '')));
begin
  if length(q) < 2 then
    return;
  end if;
  return query
    select p.id, trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name),
           (select h.name from public.household_members hm join public.households h on h.id = hm.household_id where hm.person_id = p.id order by h.name limit 1)
    from public.people p
    where p.tenant_id = d.tenant_id and p.archived_at is null and p.status in ('active', 'trial')
      and 'student' = any (p.type_flags)
      and (lower(p.first_name) like q || '%' or lower(p.last_name) like q || '%' or lower(coalesce(p.preferred_name, '')) like q || '%'
           or lower(p.first_name || ' ' || p.last_name) like q || '%')
    order by p.first_name, p.last_name
    limit 12;
end;
$$;

-- The family behind a tapped person: household, PIN state and the students who can check in together.
create or replace function public.kiosk_family(p_token text, p_person_id uuid)
returns table (household_id uuid, household_name text, has_pin boolean, locked_until timestamptz, person_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  hid uuid;
begin
  select hm.household_id into hid
  from public.household_members hm join public.people p on p.id = hm.person_id
  where hm.person_id = p_person_id and p.tenant_id = d.tenant_id
  order by hm.created_at limit 1;
  if hid is null then
    raise exception 'not in a household' using errcode = '22023';
  end if;
  return query
    select h.id, h.name, kp.id is not null, kp.locked_until, p.id, trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name)
    from public.households h
    join public.household_members hm on hm.household_id = h.id and hm.relationship = 'student'
    join public.people p on p.id = hm.person_id and p.archived_at is null and p.status in ('active', 'trial')
    left join public.kiosk_pins kp on kp.household_id = h.id
    where h.id = hid and h.tenant_id = d.tenant_id
    order by (p.id = p_person_id) desc, p.first_name;
end;
$$;

-- Verify a household PIN, counting failures. Returns ok, attempts_left and locked_until.
create or replace function app.kiosk_check_pin(p_tenant_id uuid, p_household_id uuid, p_pin text)
returns table (ok boolean, attempts_left int, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  kp public.kiosk_pins;
begin
  select * into kp from public.kiosk_pins where household_id = p_household_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'no PIN set for this family' using errcode = '22023';
  end if;
  if kp.locked_until is not null and kp.locked_until > now() then
    return query select false, 0, kp.locked_until;
    return;
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and kp.pin_hash = extensions.crypt(p_pin, kp.pin_hash) then
    update public.kiosk_pins set failed_attempts = 0, locked_until = null where id = kp.id;
    return query select true, 5, null::timestamptz;
    return;
  end if;
  if kp.failed_attempts + 1 >= 5 then
    update public.kiosk_pins set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = kp.id
      returning public.kiosk_pins.locked_until into kp.locked_until;
    return query select false, 0, kp.locked_until;
  else
    update public.kiosk_pins set failed_attempts = failed_attempts + 1, locked_until = null where id = kp.id;
    return query select false, 5 - (kp.failed_attempts + 1), null::timestamptz;
  end if;
end;
$$;

create or replace function public.kiosk_unlock(p_token text, p_household_id uuid, p_pin text)
returns table (ok boolean, attempts_left int, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
begin
  return query select * from app.kiosk_check_pin(d.tenant_id, p_household_id, p_pin);
end;
$$;

-- Today's sessions at the device's location that these people can check into (enrolled program or
-- booked), with the one starting within ±30 minutes suggested.
create or replace function public.kiosk_sessions(p_token text, p_person_ids uuid[])
returns table (person_id uuid, session_id uuid, name text, starts_at timestamptz, ends_at timestamptz, suggested boolean, already_in boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  tz text;
  day_start timestamptz;
begin
  select coalesce(l.timezone, t.timezone) into tz from public.locations l join public.tenants t on t.id = l.tenant_id where l.id = d.location_id;
  day_start := (date_trunc('day', now() at time zone tz)) at time zone tz;
  return query
    with candidates as (
      select pid as person_id, s.id as session_id, s.name, s.starts_at, s.ends_at
      from unnest(p_person_ids) as pid
      join public.people p on p.id = pid and p.tenant_id = d.tenant_id
      join public.class_sessions s on s.tenant_id = d.tenant_id and s.location_id = d.location_id and s.status = 'scheduled'
        and s.starts_at >= day_start and s.starts_at < day_start + interval '1 day'
      where exists (select 1 from public.enrollments e where e.person_id = pid and e.status = 'active' and e.program_id = any (s.program_ids))
         or exists (select 1 from public.bookings b where b.person_id = pid and b.session_id = s.id and b.status in ('booked', 'attended'))
    ),
    ranked as (
      select c.*, row_number() over (partition by c.person_id order by abs(extract(epoch from (c.starts_at - now())))) as rn
      from candidates c
    )
    select r.person_id, r.session_id, r.name, r.starts_at, r.ends_at,
           (r.rn = 1 and abs(extract(epoch from (r.starts_at - now()))) <= 1800),
           exists (select 1 from public.attendance a where a.session_id = r.session_id and a.person_id = r.person_id)
    from ranked r
    order by r.starts_at, r.person_id;
end;
$$;

-- Check people in (PIN re-verified: the kiosk keeps no server-side unlock state).
create or replace function public.kiosk_check_in(p_token text, p_household_id uuid, p_pin text, p_items jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  v record;
  item jsonb;
  n int := 0;
  pid uuid;
  sid uuid;
begin
  select * into v from app.kiosk_check_pin(d.tenant_id, p_household_id, p_pin);
  if not v.ok then
    raise exception 'PIN not accepted' using errcode = '42501';
  end if;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    pid := (item ->> 'person_id')::uuid;
    sid := (item ->> 'session_id')::uuid;
    if not exists (select 1 from public.household_members hm where hm.household_id = p_household_id and hm.person_id = pid) then
      raise exception 'person not in this family' using errcode = '42501';
    end if;
    if not exists (select 1 from public.class_sessions s where s.id = sid and s.tenant_id = d.tenant_id and s.location_id = d.location_id and s.status = 'scheduled') then
      raise exception 'session not available at this kiosk' using errcode = '42501';
    end if;
    insert into public.attendance (tenant_id, session_id, person_id, source)
    values (d.tenant_id, sid, pid, 'kiosk')
    on conflict (session_id, person_id) do nothing;
    if found then n := n + 1; end if;
    update public.bookings set status = 'attended' where session_id = sid and person_id = pid and status = 'booked';
  end loop;
  return n;
end;
$$;

-- Photo-confirm mode (staff-configured): check-in without a PIN, still scoped to the family.
create or replace function public.kiosk_check_in_confirmed(p_token text, p_household_id uuid, p_items jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  item jsonb;
  n int := 0;
  pid uuid;
  sid uuid;
begin
  if coalesce(d.settings ->> 'confirm', 'pin') <> 'photo' then
    raise exception 'this kiosk requires a PIN' using errcode = '42501';
  end if;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    pid := (item ->> 'person_id')::uuid;
    sid := (item ->> 'session_id')::uuid;
    if not exists (select 1 from public.household_members hm join public.households h on h.id = hm.household_id
                   where hm.household_id = p_household_id and hm.person_id = pid and h.tenant_id = d.tenant_id) then
      raise exception 'person not in this family' using errcode = '42501';
    end if;
    if not exists (select 1 from public.class_sessions s where s.id = sid and s.tenant_id = d.tenant_id and s.location_id = d.location_id and s.status = 'scheduled') then
      raise exception 'session not available at this kiosk' using errcode = '42501';
    end if;
    insert into public.attendance (tenant_id, session_id, person_id, source) values (d.tenant_id, sid, pid, 'kiosk')
    on conflict (session_id, person_id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

revoke execute on function app.kiosk_device(text), app.kiosk_check_pin(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.kiosk_info(text), public.kiosk_search(text, text), public.kiosk_family(text, uuid),
  public.kiosk_unlock(text, uuid, text), public.kiosk_sessions(text, uuid[]), public.kiosk_check_in(text, uuid, text, jsonb),
  public.kiosk_check_in_confirmed(text, uuid, jsonb) from public;
grant execute on function public.kiosk_info(text), public.kiosk_search(text, text), public.kiosk_family(text, uuid),
  public.kiosk_unlock(text, uuid, text), public.kiosk_sessions(text, uuid[]), public.kiosk_check_in(text, uuid, text, jsonb),
  public.kiosk_check_in_confirmed(text, uuid, jsonb) to anon, authenticated;
