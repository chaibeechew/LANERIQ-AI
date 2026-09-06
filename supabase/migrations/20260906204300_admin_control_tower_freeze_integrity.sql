-- Final database-side freeze semantics and table-specific creation guards.
-- Frozen releases are append-only: new evidence/decision records may be appended,
-- but existing workstreams/items cannot be mutated or deleted.

create or replace function public.control_tower_guard_release_initial_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage not in ('idea','planned') then
    raise exception 'New Control Tower releases must begin at idea or planned'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.control_tower_guard_workstream_initial_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage not in ('idea','planned','ready') then
    raise exception 'New Control Tower workstreams must begin at idea, planned, or ready'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.control_tower_guard_item_initial_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_type = 'evidence' then
    if new.stage <> 'verification' then
      raise exception 'Evidence must be registered at verification stage'
        using errcode = 'check_violation';
    end if;
  elsif new.stage not in ('idea','planned','ready','in_progress') then
    raise exception 'New Control Tower items must begin before code-complete verification stages'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.control_tower_guard_release_initial_stage() from public, anon, authenticated;
revoke all on function public.control_tower_guard_workstream_initial_stage() from public, anon, authenticated;
revoke all on function public.control_tower_guard_item_initial_stage() from public, anon, authenticated;

drop trigger if exists control_tower_release_initial_stage_guard on public.control_tower_releases;
drop trigger if exists control_tower_workstream_initial_stage_guard on public.control_tower_workstreams;
drop trigger if exists control_tower_item_initial_stage_guard on public.control_tower_items;

create trigger control_tower_release_initial_stage_guard
before insert on public.control_tower_releases
for each row execute function public.control_tower_guard_release_initial_stage();

create trigger control_tower_workstream_initial_stage_guard
before insert on public.control_tower_workstreams
for each row execute function public.control_tower_guard_workstream_initial_stage();

create trigger control_tower_item_initial_stage_guard
before insert on public.control_tower_items
for each row execute function public.control_tower_guard_item_initial_stage();

create or replace function public.control_tower_guard_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_stage text;
  target_release uuid;
  target_type text;
begin
  if tg_op = 'DELETE' then
    target_release := old.release_id;
    target_type := old.item_type;
  else
    target_release := new.release_id;
    target_type := new.item_type;
  end if;

  select r.stage into release_stage
  from public.control_tower_releases r
  where r.id = target_release;

  if release_stage = 'closed' then
    raise exception 'Closed Control Tower releases are immutable'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if release_stage in ('release_candidate','production','observed') then
    if tg_op = 'INSERT' and target_type in ('evidence','decision') then
      return new;
    end if;
    raise exception 'Control Tower release is frozen at stage %; existing items are immutable and only new evidence/decision may be appended', release_stage
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.control_tower_guard_item_mutation() from public, anon, authenticated;
