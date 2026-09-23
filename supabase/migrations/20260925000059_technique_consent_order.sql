-- 0059 The technique consent backstop ran (security definer) before RLS, so a cross-tenant insert was refused
-- with a message about that person's consent instead of by RLS. Only check rows in the caller's own tenant
-- (or service-role writes); anything else is left for RLS to reject without revealing anything.
create or replace function app.technique_consent_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.tenant_id is distinct from app.tenant_id() then
    return new;
  end if;
  if coalesce(app.needs_ai_consent(new.person_id), true) then
    raise exception 'a guardian needs to give AI-processing consent before a clip of a minor is analysed' using errcode = '22023';
  end if;
  return new;
end;
$$;
