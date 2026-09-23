-- 0049 Approval queue (§2.5, M4.02). Agents draft; people approve. Anything AI-drafted that reaches a family
-- or changes attendance, stock, ranks or money waits here. Deciding is a definer RPC (ai.approve, the
-- Intelligence module): approval stores the possibly edited payload and marks the item approved; the app then
-- executes the deferred action and records the result. Rejections keep the reason as feedback.

create table public.approval_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('drift_outreach', 'action_board', 'doc_intake', 'billing_recovery', 'parent_narrative', 'vision_feedback', 'copilot_write', 'other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  title text not null,
  preview text not null default '',
  payload jsonb not null default '{}'::jsonb,
  ai_run_id uuid,
  entity_type text,
  entity_id uuid,
  person_id uuid,
  requested_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  feedback text,
  executed_at timestamptz,
  execution_result jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ai_run_id) references public.ai_runs (id) on delete set null,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
create index approval_items_pending on public.approval_items (tenant_id, created_at) where status = 'pending';
select app.setup_tenant_table('public.approval_items', 'ai.use', 'ai.use', 'intelligence');

-- Decide one item. Approving may replace the payload with the reviewer's edits (same kind, validated by the
-- executor). Only pending items can be decided; returns the updated row.
create or replace function public.decide_approval(p_id uuid, p_decision text, p_payload jsonb default null, p_feedback text default null)
returns public.approval_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.approval_items;
begin
  if app.tenant_id() is null or not app.has_module('intelligence') or not app.has_permission('ai.approve') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_feedback, ''))) < 2 then
    raise exception 'say why it was rejected' using errcode = '22023';
  end if;
  update public.approval_items
     set status = p_decision, payload = coalesce(p_payload, payload), feedback = nullif(trim(coalesce(p_feedback, '')), ''),
         decided_by = auth.uid(), decided_at = now()
   where id = p_id and tenant_id = app.tenant_id() and status = 'pending' and (expires_at is null or expires_at > now())
  returning * into it;
  if not found then
    raise exception 'this item was already decided or has expired' using errcode = '22023';
  end if;
  return it;
end;
$$;

-- Record what executing an approved item did (or why it failed).
create or replace function public.record_approval_execution(p_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_permission('ai.approve') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.approval_items set executed_at = now(), execution_result = p_result
   where id = p_id and tenant_id = app.tenant_id() and status = 'approved';
end;
$$;

revoke execute on function public.decide_approval(uuid, text, jsonb, text), public.record_approval_execution(uuid, jsonb) from public, anon;
grant execute on function public.decide_approval(uuid, text, jsonb, text), public.record_approval_execution(uuid, jsonb) to authenticated;

select app.index_foreign_keys();
