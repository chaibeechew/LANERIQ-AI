-- Every user-context mutation of core Control Tower state writes a sealed audit event
-- in the same database transaction. Critical service-role flows already write their own
-- actor-preserving audit event inside their RPC transaction.

create or replace function public.control_tower_transactional_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  row_id uuid;
  entity text;
  action_name text;
  before_json jsonb;
  after_json jsonb;
begin
  actor := auth.uid();
  -- Service-role/migration flows have no human uid and use their dedicated atomic RPC audit.
  if actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'control_tower_releases' then
    entity := 'release';
  elsif tg_table_name = 'control_tower_workstreams' then
    entity := 'workstream';
  elsif tg_table_name = 'control_tower_items' then
    if tg_op = 'DELETE' then entity := coalesce(old.item_type, 'item');
    else entity := coalesce(new.item_type, 'item');
    end if;
  elsif tg_table_name = 'control_tower_release_gates' then
    entity := 'release_gate';
  else
    entity := tg_table_name;
  end if;

  if tg_op = 'INSERT' then
    row_id := new.id;
    before_json := null;
    after_json := to_jsonb(new);
    action_name := entity || '_inserted';
  elsif tg_op = 'UPDATE' then
    row_id := new.id;
    before_json := to_jsonb(old);
    after_json := to_jsonb(new);
    action_name := entity || '_updated';
  else
    row_id := old.id;
    before_json := to_jsonb(old);
    after_json := null;
    action_name := entity || '_deleted';
  end if;

  insert into public.control_tower_audit_log(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  ) values (
    actor,
    action_name,
    entity,
    row_id,
    before_json,
    after_json,
    jsonb_build_object(
      'source', 'database_trigger',
      'table', tg_table_name,
      'operation', lower(tg_op)
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.control_tower_transactional_audit() from public, anon, authenticated;

drop trigger if exists control_tower_releases_transactional_audit on public.control_tower_releases;
drop trigger if exists control_tower_workstreams_transactional_audit on public.control_tower_workstreams;
drop trigger if exists control_tower_items_transactional_audit on public.control_tower_items;
drop trigger if exists control_tower_release_gates_transactional_audit on public.control_tower_release_gates;

create trigger control_tower_releases_transactional_audit
after insert or update or delete on public.control_tower_releases
for each row execute function public.control_tower_transactional_audit();

create trigger control_tower_workstreams_transactional_audit
after insert or update or delete on public.control_tower_workstreams
for each row execute function public.control_tower_transactional_audit();

create trigger control_tower_items_transactional_audit
after insert or update or delete on public.control_tower_items
for each row execute function public.control_tower_transactional_audit();

create trigger control_tower_release_gates_transactional_audit
after insert or update or delete on public.control_tower_release_gates
for each row execute function public.control_tower_transactional_audit();
