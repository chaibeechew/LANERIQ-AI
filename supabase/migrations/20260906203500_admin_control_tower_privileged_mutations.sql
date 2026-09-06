-- Critical Control Tower mutations are authorized by the user session in the API,
-- then executed through the server-only service role. Ordinary authenticated DB access
-- cannot directly promote releases or insert evidence snapshots.

create or replace function public.control_tower_guard_release_stage_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stages constant text[] := array['idea','planned','ready','in_progress','code_complete','verification','release_candidate','production','observed','closed'];
  old_index integer;
  new_index integer;
  actor_role text;
  jwt_role text;
begin
  if new.stage = old.stage then return new; end if;
  old_index := array_position(stages, old.stage);
  new_index := array_position(stages, new.stage);
  actor_role := coalesce(
    auth.jwt()->'app_metadata'->>'control_tower_role',
    auth.jwt()->'app_metadata'->>'role',
    ''
  );
  jwt_role := coalesce(auth.role(), '');

  if new.stage = 'production'
     and jwt_role <> 'service_role'
     and actor_role not in ('owner','super_admin') then
    raise exception 'Owner or Super Admin authority required for Production promotion'
      using errcode = 'insufficient_privilege';
  end if;

  if new_index = old_index + 1 then return new; end if;
  if new_index = old_index - 1 and old.stage not in ('production','observed','closed') then return new; end if;

  raise exception 'Invalid Control Tower release stage transition: % -> %', old.stage, new.stage
    using errcode = 'check_violation';
end;
$$;

create or replace function public.control_tower_guard_initial_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'control_tower_releases' and new.stage not in ('idea','planned') then
    raise exception 'New Control Tower releases must begin at idea or planned'
      using errcode = 'check_violation';
  end if;
  if tg_table_name = 'control_tower_workstreams' and new.stage not in ('idea','planned','ready') then
    raise exception 'New Control Tower workstreams must begin at idea, planned, or ready'
      using errcode = 'check_violation';
  end if;
  if tg_table_name = 'control_tower_items' and new.item_type <> 'evidence'
     and new.stage not in ('idea','planned','ready','in_progress') then
    raise exception 'New Control Tower items must begin before code-complete verification stages'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.control_tower_guard_item_release_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workstream_id is not null and not exists (
    select 1
    from public.control_tower_workstreams w
    where w.id = new.workstream_id
      and w.release_id = new.release_id
  ) then
    raise exception 'Control Tower item workstream must belong to the same release'
      using errcode = 'foreign_key_violation';
  end if;

  if new.item_type = 'evidence' then
    if coalesce(new.metadata->>'fingerprint', '') !~ '^[0-9a-f]{64}$'
       or nullif(new.metadata->>'kind', '') is null
       or nullif(new.metadata->>'captured_at', '') is null then
      raise exception 'Control Tower evidence requires a sealed fingerprint, kind, and captured_at'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.control_tower_guard_initial_stage() from public, anon, authenticated;
revoke all on function public.control_tower_guard_item_release_integrity() from public, anon, authenticated;
revoke all on function public.control_tower_guard_release_stage_transition() from public, anon, authenticated;

create trigger control_tower_release_initial_stage_guard
before insert on public.control_tower_releases
for each row execute function public.control_tower_guard_initial_stage();

create trigger control_tower_workstream_initial_stage_guard
before insert on public.control_tower_workstreams
for each row execute function public.control_tower_guard_initial_stage();

create trigger control_tower_item_initial_stage_guard
before insert on public.control_tower_items
for each row execute function public.control_tower_guard_initial_stage();

create trigger control_tower_item_release_integrity_guard
before insert or update of release_id, workstream_id, item_type, metadata on public.control_tower_items
for each row execute function public.control_tower_guard_item_release_integrity();

-- Ordinary admins may edit release metadata but not stage or immutable Production truth.
revoke update on public.control_tower_releases from authenticated;
grant update (
  release_status,
  capability_layer,
  target_platforms,
  release_notes,
  target_date
) on public.control_tower_releases to authenticated;

-- Evidence registration is API-authorized then service-role executed. Split the previous
-- catch-all policy so direct authenticated inserts cannot forge evidence rows.
drop policy if exists control_tower_items_admin_all on public.control_tower_items;

create policy control_tower_items_admin_select
on public.control_tower_items
for select to authenticated
using (public.is_control_tower_admin());

create policy control_tower_items_admin_insert
on public.control_tower_items
for insert to authenticated
with check (public.is_control_tower_admin() and item_type <> 'evidence');

create policy control_tower_items_admin_update
on public.control_tower_items
for update to authenticated
using (public.is_control_tower_admin())
with check (public.is_control_tower_admin());

create policy control_tower_items_admin_delete
on public.control_tower_items
for delete to authenticated
using (public.is_control_tower_admin());
