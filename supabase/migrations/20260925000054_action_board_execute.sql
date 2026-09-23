-- 0054 Carrying out an approved action board atomically (M4.06): attendance, sign-offs, notes, injury notes
-- and follow-up tasks are written in one transaction, exactly once, from the approved payload itself. The
-- instructor who approves needs ai.approve and attendance.write; the board is what grants the task/note writes
-- (an instructor can't otherwise create tasks), so the function checks every row belongs to that class.

create or replace function public.execute_action_board(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  it public.approval_items;
  p jsonb;
  sid uuid;
  r jsonb;
  n_att int := 0;
  n_sign int := 0;
  n_notes int := 0;
  n_inj int := 0;
  n_tasks int := 0;
  roster uuid[];
  result jsonb;
begin
  if tid is null or not app.has_module('intelligence') or not app.has_permission('ai.approve') or not app.has_permission('attendance.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into it from public.approval_items where id = p_id and tenant_id = tid and kind = 'action_board' for update;
  if not found or it.status <> 'approved' then
    raise exception 'approve the board first' using errcode = '22023';
  end if;
  if it.executed_at is not null then
    return it.execution_result;
  end if;
  p := it.payload;
  sid := (p ->> 'session_id')::uuid;
  if sid is distinct from it.entity_id or not exists (select 1 from public.class_sessions where id = sid and tenant_id = tid) then
    raise exception 'the board does not match its class' using errcode = '22023';
  end if;
  select array_agg(person_id) into roster from public.v_class_roster where session_id = sid;

  for r in select * from jsonb_array_elements(coalesce(p -> 'attendance', '[]')) loop
    continue when not (r ->> 'include')::boolean or not ((r ->> 'person_id')::uuid = any (roster));
    insert into public.attendance (tenant_id, session_id, person_id, source, checked_in_by_user_id)
    values (tid, sid, (r ->> 'person_id')::uuid, 'action_board', auth.uid()) on conflict (session_id, person_id) do nothing;
    update public.bookings set status = 'attended' where session_id = sid and person_id = (r ->> 'person_id')::uuid and status = 'booked';
    n_att := n_att + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'skill_notes', '[]')) loop
    continue when not (r ->> 'include')::boolean or not ((r ->> 'person_id')::uuid = any (roster));
    if (r ->> 'sign_off')::boolean and nullif(r ->> 'skill_id', '') is not null and nullif(r ->> 'enrollment_id', '') is not null
       and exists (select 1 from public.enrollments e where e.id = (r ->> 'enrollment_id')::uuid and e.person_id = (r ->> 'person_id')::uuid and e.tenant_id = tid) then
      insert into public.skill_signoffs (tenant_id, enrollment_id, skill_id, by_user_id, notes, source)
      values (tid, (r ->> 'enrollment_id')::uuid, (r ->> 'skill_id')::uuid, auth.uid(), nullif(trim(r ->> 'note'), ''), 'action_board')
      on conflict (enrollment_id, skill_id) do update set signed_off_at = now(), by_user_id = auth.uid(), notes = excluded.notes, source = excluded.source;
      n_sign := n_sign + 1;
    else
      insert into public.notes (tenant_id, person_id, kind, body, source, by_user_id)
      values (tid, (r ->> 'person_id')::uuid, 'progress', coalesce(nullif(r ->> 'skill_name', '') || ': ', '') || (r ->> 'note'), 'action_board', auth.uid());
      n_notes := n_notes + 1;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'injuries', '[]')) loop
    continue when not (r ->> 'include')::boolean or not ((r ->> 'person_id')::uuid = any (roster));
    insert into public.notes (tenant_id, person_id, kind, body, pinned, source, by_user_id)
    values (tid, (r ->> 'person_id')::uuid, 'injury', r ->> 'note', true, 'action_board', auth.uid());
    n_inj := n_inj + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'follow_ups', '[]')) loop
    continue when not (r ->> 'include')::boolean;
    insert into public.tasks (tenant_id, title, person_id, source, related_type, related_id, data, created_by)
    values (tid, left(r ->> 'title', 200), case when (nullif(r ->> 'person_id', ''))::uuid = any (roster) then (r ->> 'person_id')::uuid end,
            'manual', 'class_session', sid, jsonb_build_object('from', 'action_board', 'approval_item_id', it.id), auth.uid());
    n_tasks := n_tasks + 1;
  end loop;

  result := jsonb_build_object('ok', true,
    'summary', n_att || ' check-ins, ' || n_sign || ' sign-offs, ' || (n_notes + n_inj) || ' notes, ' || n_tasks || ' task' || case when n_tasks = 1 then '' else 's' end,
    'detail', jsonb_build_object('checkins', n_att, 'signoffs', n_sign, 'notes', n_notes, 'injuries', n_inj, 'tasks', n_tasks));
  update public.approval_items set executed_at = now(), execution_result = result where id = it.id;
  return result;
end;
$$;
revoke execute on function public.execute_action_board(uuid) from public, anon;
grant execute on function public.execute_action_board(uuid) to authenticated;
