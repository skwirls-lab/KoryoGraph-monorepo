-- 0064 Home notifications (M5.05): in-app messages get a read state; browsers can subscribe to web push
-- (sent only when the server has VAPID keys).

alter table public.communications add column read_at timestamptz;

-- Mark the caller's own in-app notifications read (families can't update communications directly).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.communications c set read_at = now()
   where c.tenant_id = app.tenant_id() and c.channel = 'inapp' and c.read_at is null
     and (c.person_id = any (app.household_person_ids()) or c.household_id = any (app.household_ids()))
     and (p_ids is null or c.id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
alter table public.push_subscriptions enable row level security;
create trigger set_updated_at before update on public.push_subscriptions for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.push_subscriptions for each row execute function app.audit_trigger();
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and tenant_id = (select app.tenant_id()))
  with check (user_id = (select auth.uid()) and tenant_id = (select app.tenant_id()));
select app.index_foreign_keys();
