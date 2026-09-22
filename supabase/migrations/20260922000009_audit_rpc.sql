-- 0009 Public wrapper so the app can log non-row events (exports, impersonation) to audit_events.
create or replace function public.audit_export(p_entity text, p_rows int)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app.audit_custom(p_entity, null, 'exported', jsonb_build_object('rows', p_rows));
$$;
revoke execute on function public.audit_export(text, int) from public, anon;
grant execute on function public.audit_export(text, int) to authenticated;
