-- 0057 Billing recovery (A8), parent narratives (A9) and lead scoring (A10) — M4.10.

-- A9: a staff-approved plain-language update about a student, shown to their family on Home.
create table public.home_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  week_of date not null,
  body text not null,
  published_at timestamptz not null default now(),
  approval_item_id uuid references public.approval_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, week_of),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.home_updates', 'ai.approve', 'people.read');
create policy home_updates_household_select on public.home_updates for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

-- A10: the AI's suggested next step (the staff-owned next_action stays theirs); score = leads.score.
alter table public.leads add column ai_next_action text, add column scored_at timestamptz;

-- A8: queue a pre-rendered message (no template) to a person's guardians (service role: dunning job).
create or replace function public.queue_prerendered(p_tenant_id uuid, p_person_ids uuid[], p_channels text[], p_subject text, p_body text, p_related_type text, p_related_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from app.recipients_for(p_tenant_id, p_person_ids) loop
    insert into public.communications (tenant_id, channel, person_id, household_id, to_address, status, subject, body_text, data, related_type, related_id)
    select p_tenant_id, c.channel, r.recipient_person_id, r.household_id, c.addr, 'queued',
           case when c.channel = 'email' then replace(coalesce(p_subject, ''), '{{first_name}}', r.first_name) end,
           replace(case when c.channel = 'sms' then split_part(p_body, E'\n---email---\n', 1) else coalesce(nullif(split_part(p_body, E'\n---email---\n', 2), ''), p_body) end, '{{first_name}}', r.first_name),
           jsonb_build_object('first_name', r.first_name, 'about_person_id', r.person_id), p_related_type, p_related_id
    from (values ('email', r.email), ('sms', r.phone)) as c(channel, addr)
    where c.channel = any (p_channels) and c.addr is not null;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.queue_prerendered(uuid, uuid[], text[], text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.queue_prerendered(uuid, uuid[], text[], text, text, text, uuid) to service_role;

insert into public.jobs (name, schedule, description) values
  ('parent_narratives', '0 16 * * 5', 'Draft weekly progress updates for families (staff approve before they appear on Home)'),
  ('lead_scoring', '*/15 * * * *', 'Score new or changed leads and suggest a next step')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
