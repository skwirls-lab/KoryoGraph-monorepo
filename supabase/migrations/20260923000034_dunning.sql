-- 0034 Dunning (F7.5): channel-specific notices from the dunning job, and automatic recovery when a
-- dunned invoice is settled (any payment path: card retry, cash at the desk, Home wallet).

-- Like app.enqueue_system_message, but only for the channels a dunning step asks for.
create or replace function public.dunning_notify(p_tenant_id uuid, p_template_key text, p_person_ids uuid[], p_data jsonb, p_invoice_id uuid, p_channels text[])
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
    insert into public.communications (tenant_id, channel, person_id, household_id, to_address, template_key, status, data, related_type, related_id)
    select p_tenant_id, c.channel, r.recipient_person_id, r.household_id, c.addr, p_template_key, 'queued',
           p_data || jsonb_build_object('first_name', r.first_name, 'about_person_id', r.person_id), 'invoice', p_invoice_id
    from (values ('email', r.email), ('sms', r.phone)) as c(channel, addr)
    where c.channel = any (p_channels) and c.addr is not null;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.dunning_notify(uuid, text, uuid[], jsonb, uuid, text[]) from public, anon, authenticated;
grant execute on function public.dunning_notify(uuid, text, uuid[], jsonb, uuid, text[]) to service_role;

-- Settling a dunned invoice ends dunning and lifts past_due/suspended from its membership (unless the
-- membership still has another past-due invoice).
create or replace function app.invoice_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('paid', 'void') and old.status is distinct from new.status then
    if new.dunning_state ? 'failed_on' and not new.dunning_state ? 'resolved_at' then
      update public.invoices set dunning_state = dunning_state || jsonb_build_object('resolved_at', now(), 'resolution', new.status) where id = new.id;
    end if;
    if new.membership_id is not null then
      update public.memberships m set status = 'active'
       where m.id = new.membership_id and m.status in ('past_due', 'suspended')
         and not exists (select 1 from public.invoices i where i.membership_id = m.id and i.id <> new.id and i.status = 'past_due' and i.balance_cents > 0);
    end if;
  end if;
  return null;
end;
$$;
create trigger invoice_settled after update of status on public.invoices
  for each row execute function app.invoice_settled();

-- Failed-payment worklist for the Desk.
create view public.v_dunning with (security_invoker = true) as
  select i.tenant_id, i.id as invoice_id, i.number, i.household_id, h.name as household_name, i.membership_id, m.status as membership_status,
         i.balance_cents, i.due_at, i.status,
         (i.dunning_state ->> 'failed_on')::date as failed_on,
         coalesce((i.dunning_state ->> 'stage')::int, 0) as stage,
         (i.dunning_state ->> 'next_step_on')::date as next_step_on,
         i.dunning_state ->> 'last_error' as last_error
  from public.invoices i
  join public.households h on h.id = i.household_id
  left join public.memberships m on m.id = i.membership_id
  where i.dunning_state ? 'failed_on' and not i.dunning_state ? 'resolved_at'
    and i.status in ('open', 'partially_paid', 'past_due') and i.balance_cents > 0;

insert into public.jobs (name, schedule, description) values
  ('dunning', '30 6 * * *', 'Retry failed payments, send payment-failed notices and suspend at the final step')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;
