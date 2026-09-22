-- 0022 Expose the signed-in member's household ids / person id to the app (thin wrappers).
create or replace function public.my_household_ids()
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select app.household_ids();
$$;
create or replace function public.my_person_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select app.person_id();
$$;
revoke execute on function public.my_household_ids(), public.my_person_id() from public, anon;
grant execute on function public.my_household_ids(), public.my_person_id() to authenticated;
