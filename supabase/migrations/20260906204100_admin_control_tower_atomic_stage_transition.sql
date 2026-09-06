-- Non-Production stage changes are authorized by the Control Tower API and executed
-- atomically by the server-only service role. Production uses the stronger attestation RPC.

create or replace function public.transition_control_tower_release_stage_server(
  p_release_id uuid,
  p_target_stage text,
  p_expected_updated_at timestamptz,
  p_actor_user_id uuid,
  p_actor_role text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.control_tower_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  stages constant text[] := array['idea','planned','ready','in_progress','code_complete','verification','release_candidate','production','observed','closed'];
  current_release public.control_tower_releases;
  result public.control_tower_releases;
  current_index integer;
  target_index integer;
  allowed boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service-role execution required for Control Tower stage transition'
      using errcode = 'insufficient_privilege';
  end if;
  if p_actor_user_id is null then
    raise exception 'Actor user id is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(p_actor_role, '') not in ('owner','super_admin','admin') then
    raise exception 'Invalid Control Tower actor role'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_target_stage = 'production' then
    raise exception 'Production must use the verified attestation promotion contract'
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

  if p_expected_updated_at is not null and current_release.updated_at is distinct from p_expected_updated_at then
    raise exception 'Release changed since it was loaded'
      using errcode = 'serialization_failure';
  end if;

  current_index := array_position(stages, current_release.stage);
  target_index := array_position(stages, p_target_stage);
  if current_index is null or target_index is null then
    raise exception 'Invalid Control Tower release stage'
      using errcode = 'invalid_parameter_value';
  end if;

  if target_index = current_index then
    allowed := true;
  elsif target_index = current_index + 1 then
    allowed := true;
  elsif target_index = current_index - 1 and current_release.stage not in ('production','observed','closed') then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'Invalid Control Tower release stage transition: % -> %', current_release.stage, p_target_stage
      using errcode = 'check_violation';
  end if;

  update public.control_tower_releases
  set stage = p_target_stage
  where id = p_release_id
  returning * into result;

  insert into public.control_tower_audit_log(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  ) values (
    p_actor_user_id,
    'release_stage_promoted',
    'release',
    p_release_id,
    to_jsonb(current_release),
    to_jsonb(result),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'actor_role', p_actor_role,
      'target_stage', p_target_stage,
      'privileged_write', true
    )
  );

  return result;
end;
$$;

revoke all on function public.transition_control_tower_release_stage_server(uuid, text, timestamptz, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.transition_control_tower_release_stage_server(uuid, text, timestamptz, uuid, text, jsonb) to service_role;
