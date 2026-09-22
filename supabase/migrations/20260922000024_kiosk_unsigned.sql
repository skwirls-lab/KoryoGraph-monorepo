-- 0024 Kiosk: which of these students have required documents still unsigned (names only).
create or replace function public.kiosk_unsigned(p_token text, p_person_ids uuid[])
returns table (person_id uuid, template_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
begin
  return query
    select p.id, t.name
    from unnest(p_person_ids) pid
    join public.people p on p.id = pid and p.tenant_id = d.tenant_id
    join public.document_templates t on t.tenant_id = d.tenant_id and t.active
    where (coalesce((t.required_for ->> 'all_students')::boolean, false)
           or exists (select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active'
                      and e.program_id::text in (select jsonb_array_elements_text(coalesce(t.required_for -> 'program_ids', '[]'::jsonb)))))
      and not exists (select 1 from public.signatures s where s.template_id = t.id and s.person_id = p.id);
end;
$$;
revoke execute on function public.kiosk_unsigned(text, uuid[]) from public;
grant execute on function public.kiosk_unsigned(text, uuid[]) to anon, authenticated;
