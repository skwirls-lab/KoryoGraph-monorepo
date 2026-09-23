-- 0029 Recompute invoice status on insert too (an invoice created after its due date starts past due).
create or replace function app.invoice_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (new.total_cents is distinct from old.total_cents or new.due_at is distinct from old.due_at
     or (new.status = 'void') is distinct from (old.status = 'void'))) then
    perform app.recompute_invoice(new.id);
  end if;
  perform app.recompute_household_balance(coalesce(new.household_id, old.household_id));
  return null;
end;
$$;
