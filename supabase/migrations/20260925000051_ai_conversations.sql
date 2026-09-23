-- 0051 Copilot and Home assistant conversations (M4.04). Each user sees only their own conversations; the
-- school sees none of a family's assistant chats (escalation creates an ordinary message thread instead).

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  surface text not null check (surface in ('desk', 'home')),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index ai_conversations_user on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'ok' check (status in ('ok', 'error')),
  fixture boolean not null default false,
  ai_run_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, conversation_id) references public.ai_conversations (tenant_id, id) on delete cascade
);
create index ai_messages_conversation on public.ai_messages (conversation_id, created_at);

-- Own rows only (no staff override: these are private chats).
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
create policy ai_conversations_own on public.ai_conversations for all to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()))
  with check (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));
create policy ai_messages_own on public.ai_messages for all to authenticated
  using (tenant_id = (select app.tenant_id()) and conversation_id in (select id from public.ai_conversations))
  with check (tenant_id = (select app.tenant_id()) and conversation_id in (select id from public.ai_conversations));
grant select, insert, update, delete on public.ai_conversations, public.ai_messages to authenticated;
-- Audit rows for chats keep who/when but never the text.
create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  b jsonb;
  a jsonb;
  k text;
  row_j jsonb := coalesce(new_j, old_j);
  tid uuid := (row_j ->> 'tenant_id')::uuid;
  -- Private text never copied into the audit log (who/when is still recorded).
  redact text[] := case tg_table_name when 'ai_messages' then array['content', 'citations', 'steps'] when 'ai_conversations' then array['title'] else '{}'::text[] end;
begin
  if cardinality(redact) > 0 then
    old_j := old_j - redact;
    new_j := new_j - redact;
    row_j := coalesce(new_j, old_j);
  end if;
  if tg_op = 'UPDATE' then
    b := '{}'::jsonb;
    a := '{}'::jsonb;
    for k in select jsonb_object_keys(new_j) loop
      if k <> 'updated_at' and (old_j -> k) is distinct from (new_j -> k) then
        b := b || jsonb_build_object(k, old_j -> k);
        a := a || jsonb_build_object(k, new_j -> k);
      end if;
    end loop;
    if a = '{}'::jsonb then
      return null;
    end if;
  else
    b := old_j;
    a := new_j;
  end if;

  -- Tenant deleted in the same transaction (cascade): nothing to attach the event to.
  if not exists (select 1 from public.tenants where id = tid) then
    return null;
  end if;

  insert into public.audit_events (tenant_id, actor_user_id, actor_role, entity_type, entity_id, action, before, after, ip, request_id)
  values (
    tid,
    auth.uid(),
    coalesce(app.role(), current_user),
    tg_table_name,
    (row_j ->> 'id')::uuid,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    b,
    a,
    coalesce(app.request_header('x-client-ip'), app.request_header('x-forwarded-for'), app.request_header('x-real-ip')),
    app.request_header('x-request-id')
  );
  return null;
end;
$$;

select app.attach_audit('public.ai_conversations');
select app.attach_audit('public.ai_messages');


select app.index_foreign_keys();
