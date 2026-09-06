-- LANERIQ AI Admin Control Tower hardening.
-- Depends on 20260906190000_admin_control_tower.sql.

create unique index if not exists control_tower_evidence_fingerprint_idx
  on public.control_tower_items ((metadata->>'fingerprint'))
  where item_type = 'evidence' and metadata ? 'fingerprint';

create index if not exists control_tower_items_external_ref_idx
  on public.control_tower_items(external_ref)
  where external_ref is not null;

create or replace function public.control_tower_guard_workstream_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_stage text;
  target_release uuid;
begin
  if tg_op = 'DELETE' then
    target_release := old.release_id;
  else
    target_release := new.release_id;
  end if;

  select r.stage into release_stage
  from public.control_tower_releases r
  where r.id = target_release;

  if release_stage in ('release_candidate','production','observed','closed') then
    raise exception 'Control Tower release is frozen at stage %', release_stage
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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

  if release_stage in ('release_candidate','production','observed','closed')
     and target_type not in ('evidence','decision') then
    raise exception 'Control Tower release is frozen at stage %; only evidence/decision append activity is allowed', release_stage
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.control_tower_guard_workstream_mutation() from public, anon, authenticated;
revoke all on function public.control_tower_guard_item_mutation() from public, anon, authenticated;
