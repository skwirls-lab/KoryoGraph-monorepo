-- 0008 People RPCs: atomic household creation (F3.1 "person + household in one form").
-- security invoker: RLS and people.write apply exactly as for direct inserts; the function only makes it
-- all-or-nothing.

create or replace function public.create_household(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  hid uuid;
  pid uuid;
  first_guardian uuid;
  m jsonb;
  c text;
  loc uuid;
begin
  if tid is null then
    raise exception 'no tenant in session' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p -> 'members', '[]'::jsonb)) = 0 then
    raise exception 'a household needs at least one person' using errcode = '22023';
  end if;

  select id into loc from public.locations where tenant_id = tid and is_default limit 1;

  insert into public.households (tenant_id, name, billing_email, notes)
  values (tid, trim(p ->> 'name'), nullif(trim(p ->> 'billing_email'), ''), nullif(p ->> 'notes', ''))
  returning id into hid;

  for m in select * from jsonb_array_elements(p -> 'members') loop
    insert into public.people (
      tenant_id, type_flags, first_name, last_name, preferred_name, dob, email, phone, email_consent, phone_sms_consent,
      allergies, status, primary_location_id, source)
    values (
      tid,
      case when m ->> 'relationship' = 'guardian' then array['guardian'] else array['student'] end,
      trim(m ->> 'first_name'),
      coalesce(trim(m ->> 'last_name'), ''),
      nullif(trim(m ->> 'preferred_name'), ''),
      nullif(m ->> 'dob', '')::date,
      nullif(trim(m ->> 'email'), ''),
      nullif(trim(m ->> 'phone'), ''),
      coalesce((m ->> 'email_consent')::boolean, false),
      coalesce((m ->> 'sms_consent')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(m -> 'allergies')), '{}'),
      case when m ->> 'relationship' = 'guardian' then 'guardian_only' else coalesce(nullif(m ->> 'status', ''), 'active') end,
      loc,
      coalesce(nullif(p ->> 'source', ''), 'desk')
    )
    returning id into pid;

    insert into public.household_members (tenant_id, household_id, person_id, relationship, is_primary_guardian, can_pickup, receives_billing)
    values (
      tid, hid, pid, m ->> 'relationship',
      first_guardian is null and m ->> 'relationship' = 'guardian',
      m ->> 'relationship' = 'guardian',
      first_guardian is null and m ->> 'relationship' = 'guardian'
    );

    if first_guardian is null and m ->> 'relationship' = 'guardian' then
      first_guardian := pid;
      update public.households set primary_payer_person_id = pid, billing_email = coalesce(billing_email, nullif(trim(m ->> 'email'), ''))
      where id = hid;
    end if;

    -- Consents recorded at the desk for minors (F2.7), attributed to the first guardian.
    for c in select jsonb_object_keys(coalesce(m -> 'consents', '{}'::jsonb)) loop
      insert into public.consents (tenant_id, person_id, guardian_person_id, kind, granted, method, recorded_by)
      values (tid, pid, first_guardian, c, coalesce((m -> 'consents' ->> c)::boolean, false), 'desk', auth.uid());
    end loop;
  end loop;

  return hid;
end;
$$;
revoke execute on function public.create_household(jsonb) from public, anon;
grant execute on function public.create_household(jsonb) to authenticated;

-- Guardians are listed before students so consents can reference the first guardian.
comment on function public.create_household(jsonb) is
  'members: [{relationship, first_name, last_name, preferred_name?, dob?, email?, phone?, email_consent?, sms_consent?, allergies?[], status?, consents?{kind: bool}}] (guardians first)';
