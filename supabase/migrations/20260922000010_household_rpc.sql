-- 0010 Add a brand-new person to an existing household atomically (security invoker: RLS applies).
create or replace function public.add_household_person(p_household_id uuid, m jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  pid uuid;
begin
  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'household not found' using errcode = '42501';
  end if;
  insert into public.people (tenant_id, type_flags, first_name, last_name, dob, email, phone, status, primary_location_id)
  values (
    tid,
    case when m ->> 'relationship' = 'guardian' then array['guardian'] else array['student'] end,
    trim(m ->> 'first_name'), coalesce(trim(m ->> 'last_name'), ''), nullif(m ->> 'dob', '')::date,
    nullif(trim(m ->> 'email'), ''), nullif(trim(m ->> 'phone'), ''),
    case when m ->> 'relationship' = 'guardian' then 'guardian_only' else 'active' end,
    (select id from public.locations where tenant_id = tid and is_default limit 1)
  )
  returning id into pid;
  insert into public.household_members (tenant_id, household_id, person_id, relationship, can_pickup)
  values (tid, p_household_id, pid, m ->> 'relationship', m ->> 'relationship' = 'guardian');
  return pid;
end;
$$;
revoke execute on function public.add_household_person(uuid, jsonb) from public, anon;
grant execute on function public.add_household_person(uuid, jsonb) to authenticated;
