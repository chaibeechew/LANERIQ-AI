-- Atomically seal the verified release attestation and promote the release to Production.

create or replace function public.promote_control_tower_production_with_attestation(
  p_release_id uuid,
  p_expected_updated_at timestamptz,
  p_verified_at timestamptz,
  p_production_truth jsonb,
  p_digest text,
  p_manifest jsonb,
  p_technical_ceiling jsonb
)
returns public.control_tower_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  current_release public.control_tower_releases;
  result public.control_tower_releases;
  attestation public.control_tower_release_attestations;
begin
  actor_role := coalesce(
    auth.jwt()->'app_metadata'->>'control_tower_role',
    auth.jwt()->'app_metadata'->>'role',
    ''
  );

  if auth.uid() is null then
    raise exception 'Authenticated actor required'
      using errcode = 'insufficient_privilege';
  end if;

  if actor_role not in ('owner', 'super_admin') then
    raise exception 'Owner or Super Admin authority required for Production promotion'
      using errcode = 'insufficient_privilege';
  end if;

  if p_verified_at is null then
    raise exception 'Production verification timestamp is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_production_truth is null or jsonb_typeof(p_production_truth) <> 'object' then
    raise exception 'Production truth snapshot is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if coalesce((p_production_truth->>'production_verified')::boolean, false) is not true
     or coalesce((p_production_truth->>'exact_sha')::boolean, false) is not true then
    raise exception 'Verified exact-SHA Production truth is required'
      using errcode = 'check_violation';
  end if;

  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid SHA-256 release attestation digest'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' then
    raise exception 'Release attestation manifest must be a JSON object'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_technical_ceiling is null
     or coalesce((p_technical_ceiling->>'overall')::integer, 0) <> 100
     or coalesce((p_technical_ceiling->>'blockerCount')::integer, -1) <> 0 then
    raise exception 'Technical Ceiling 100 with zero blockers is required'
      using errcode = 'check_violation';
  end if;

  select * into current_release
  from public.control_tower_releases r
  where r.id = p_release_id
  for update;

  if current_release.id is null then
    raise exception 'Release does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  if current_release.release_status <> 'active' then
    raise exception 'Only the Current Release may be promoted to Production'
      using errcode = 'check_violation';
  end if;

  if current_release.stage <> 'release_candidate' then
    raise exception 'Production promotion requires release_candidate stage'
      using errcode = 'check_violation';
  end if;

  if p_expected_updated_at is not null and current_release.updated_at is distinct from p_expected_updated_at then
    raise exception 'Release changed since it was loaded'
      using errcode = 'serialization_failure';
  end if;

  attestation := public.append_control_tower_release_attestation(
    p_release_id,
    p_digest,
    p_manifest,
    p_technical_ceiling
  );

  update public.control_tower_releases
  set
    stage = 'production',
    production_verified_at = p_verified_at,
    production_verified_by = auth.uid(),
    production_truth = p_production_truth
  where id = p_release_id
  returning * into result;

  perform public.append_control_tower_audit(
    'release_promoted_to_production',
    'release',
    p_release_id,
    to_jsonb(current_release),
    to_jsonb(result),
    jsonb_build_object(
      'actor_role', actor_role,
      'attestation_id', attestation.id,
      'attestation_digest', p_digest,
      'technical_ceiling', p_technical_ceiling
    )
  );

  return result;
end;
$$;

revoke all on function public.promote_control_tower_production_with_attestation(uuid, timestamptz, timestamptz, jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.promote_control_tower_production_with_attestation(uuid, timestamptz, timestamptz, jsonb, text, jsonb, jsonb) to authenticated;
