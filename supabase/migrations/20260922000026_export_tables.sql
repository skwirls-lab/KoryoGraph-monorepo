-- 0026 Table list for the data_export job (service role only).
create or replace function public.export_table_names()
returns table (table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.table_name::text from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
  order by 1;
$$;
revoke execute on function public.export_table_names() from public, anon, authenticated;
grant execute on function public.export_table_names() to service_role;
