-- Evidence trust boundary: human-submitted evidence may never masquerade as machine
-- evidence, system evidence may only be written by service_role, and all evidence is
-- immutable after insertion regardless of release stage.

create or replace function public.control_tower_guard_evidence_trust()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  trust_level text;
  evidence_kind text;
  source_provider text;
  jwt_role text;
  human_kinds constant text[] := array['manual','screenshot','incident','github_pr'];
  machine_kinds constant text[] := array[
    'github_ci','vercel_deployment','supabase_migration','benchmark','security',
    'backup_restore','chaos_drill','supply_chain','observability','capacity',
    'release_snapshot','production_truth','audit_integrity'
  ];
begin
  if new.item_type <> 'evidence' then return new; end if;

  trust_level := coalesce(new.metadata->>'trust_level', '');
  evidence_kind := coalesce(new.metadata->>'kind', '');
  source_provider := coalesce(new.metadata->>'source_provider', '');
  jwt_role := coalesce(auth.role(), '');

  if trust_level not in ('human','system') then
    raise exception 'Control Tower evidence requires an explicit human or system trust level'
      using errcode = 'check_violation';
  end if;

  if trust_level = 'human' then
    if not (evidence_kind = any(human_kinds)) then
      raise exception 'Human evidence cannot satisfy machine evidence kind %', evidence_kind
        using errcode = 'check_violation';
    end if;
    if source_provider <> 'control-tower-api' then
      raise exception 'Human evidence source provider must be control-tower-api'
        using errcode = 'check_violation';
    end if;
    if nullif(new.metadata->>'subject_sha', '') is not null then
      raise exception 'Human evidence cannot claim a release-bound subject SHA'
        using errcode = 'check_violation';
    end if;
  end if;

  if trust_level = 'system' then
    if jwt_role <> 'service_role' then
      raise exception 'System evidence requires service-role execution'
        using errcode = 'insufficient_privilege';
    end if;
    if not (evidence_kind = any(machine_kinds)) then
      raise exception 'Invalid system evidence kind %', evidence_kind
        using errcode = 'check_violation';
    end if;
    if nullif(source_provider, '') is null then
      raise exception 'System evidence requires an explicit source provider'
        using errcode = 'check_violation';
    end if;
  end if;

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

  if target_type = 'evidence' and tg_op in ('UPDATE','DELETE') then
    raise exception 'Control Tower evidence is append-only and immutable after registration'
      using errcode = 'insufficient_privilege';
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

revoke all on function public.control_tower_guard_evidence_trust() from public, anon, authenticated;
revoke all on function public.control_tower_guard_item_mutation() from public, anon, authenticated;

drop trigger if exists control_tower_evidence_trust_guard on public.control_tower_items;
create trigger control_tower_evidence_trust_guard
before insert or update of item_type, metadata on public.control_tower_items
for each row execute function public.control_tower_guard_evidence_trust();
