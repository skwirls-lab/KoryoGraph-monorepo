-- 0035 Home wallet (F7.7, F15.4): member-safe RPCs for the family's own cards, autopay and hold requests,
-- plus the §4.9 `tasks` table (brought forward from M3.02) so a hold request lands in front of staff.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assignee_user_id uuid references auth.users (id) on delete set null,
  person_id uuid,
  lead_id uuid,
  title text not null check (length(trim(title)) > 0),
  body text,
  due_at timestamptz,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'automation', 'request')),
  related_type text,
  related_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.tasks', 'people.write', 'people.read');
create index tasks_open on public.tasks (tenant_id, due_at) where done_at is null;

-- Is the caller staff with billing.charge, or a member of this household (Home)?
create or replace function app.can_manage_household_billing(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.tenant_id() is not null and app.has_module('billing')
     and exists (select 1 from public.households where id = p_household_id and tenant_id = app.tenant_id())
     and (app.has_permission('billing.charge') or p_household_id = any (app.household_ids()));
$$;

-- After the server detached the card at Stripe, mark it detached (moves the default to another card).
create or replace function public.mark_payment_method_detached(p_payment_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pm public.payment_methods;
  nxt uuid;
begin
  select * into pm from public.payment_methods where id = p_payment_method_id and tenant_id = app.tenant_id();
  if not found or not app.can_manage_household_billing(pm.household_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.payment_methods set status = 'detached', is_default = false where id = pm.id;
  update public.memberships set autopay = false, payment_method_id = null where payment_method_id = pm.id;
  if pm.is_default then
    select id into nxt from public.payment_methods where household_id = pm.household_id and status = 'active' order by created_at desc limit 1;
    if nxt is not null then
      update public.payment_methods set is_default = true where id = nxt;
    end if;
  end if;
end;
$$;

-- Autopay on/off for a membership, with a card from the same household.
create or replace function public.set_membership_autopay(p_membership_id uuid, p_enabled boolean, p_payment_method_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memberships;
  pmid uuid := p_payment_method_id;
begin
  select * into m from public.memberships where id = p_membership_id and tenant_id = app.tenant_id();
  if not found or not app.can_manage_household_billing(m.household_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_enabled then
    if pmid is null then
      select id into pmid from public.payment_methods where household_id = m.household_id and status = 'active' order by is_default desc, created_at desc limit 1;
    end if;
    if pmid is null or not exists (select 1 from public.payment_methods where id = pmid and household_id = m.household_id and status = 'active') then
      raise exception 'add a card before turning on autopay' using errcode = '22023';
    end if;
    update public.memberships set autopay = true, payment_method_id = pmid where id = m.id;
  else
    update public.memberships set autopay = false where id = m.id;
  end if;
end;
$$;

-- A family asks to put a membership on hold: a task for staff (who apply the hold on the Desk).
create or replace function public.request_membership_hold(p_membership_id uuid, p_from date, p_until date, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memberships;
  who text;
  tid uuid;
begin
  select * into m from public.memberships where id = p_membership_id and tenant_id = app.tenant_id();
  if not found or not app.can_manage_household_billing(m.household_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is null or p_until is null or p_until <= p_from or p_from < app.tenant_today(m.tenant_id) then
    raise exception 'choose a start date from today and an end date after it' using errcode = '22023';
  end if;
  if p_until - p_from > 180 then
    raise exception 'holds can be up to 180 days' using errcode = '22023';
  end if;
  select trim(coalesce(preferred_name, first_name) || ' ' || last_name) into who from public.people where id = m.person_id;
  insert into public.tasks (tenant_id, person_id, title, body, due_at, source, related_type, related_id, data, created_by)
  values (m.tenant_id, m.person_id, 'Hold request: ' || who || ' (' || p_from || ' → ' || p_until || ')',
          nullif(trim(coalesce(p_reason, '')), ''), (p_from::timestamp at time zone 'UTC'), 'request', 'membership', m.id,
          jsonb_build_object('kind', 'hold_request', 'from', p_from, 'until', p_until), auth.uid())
  returning id into tid;
  return tid;
end;
$$;

revoke execute on function public.mark_payment_method_detached(uuid), public.set_membership_autopay(uuid, boolean, uuid),
  public.request_membership_hold(uuid, date, date, text) from public, anon;
grant execute on function public.mark_payment_method_detached(uuid), public.set_membership_autopay(uuid, boolean, uuid),
  public.request_membership_hold(uuid, date, date, text) to authenticated;
revoke execute on function app.can_manage_household_billing(uuid) from public;

select app.index_foreign_keys();
