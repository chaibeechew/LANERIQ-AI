-- Register a sanitized evidence snapshot and its audit event in one transaction.
-- This function is callable only by the service role after the API has authenticated
-- the human actor and sanitized/bounded the evidence payload.

create or replace function public.register_control_tower_evidence_server(
  p_release_id uuid,
  p_title text,
  p_description text,
  p_external_ref text,
  p_metadata jsonb,
  p_actor_user_id uuid,
  p_actor_role text
)
returns public.control_tower_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_row public.control_tower_releases;
  result public.control_tower_items;
  fingerprint text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service-role execution required for Control Tower evidence registration'
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
  if nullif(pg_catalog.btrim(p_title), '') is null or length(p_title) > 240 then
    raise exception 'Invalid evidence title'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Evidence metadata must be a JSON object'
      using errcode = 'invalid_parameter_value';
  end if;

  fingerprint := p_metadata->>'fingerprint';
  if coalesce(fingerprint, '') !~ '^[0-9a-f]{64}$'
     or nullif(p_metadata->>'kind', '') is null
     or nullif(p_metadata->>'captured_at', '') is null then
    raise exception 'Evidence requires fingerprint, kind, and captured_at'
      using errcode = 'check_violation';
  end if;

  select * into release_row
  from public.control_tower_releases r
  where r.id = p_release_id
  for update;

  if release_row.id is null then
    raise exception 'Release does not exist'
      using errcode = 'foreign_key_violation';
  end if;
  if release_row.stage = 'closed' then
    raise exception 'Closed releases cannot accept new evidence'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  insert into public.control_tower_items(
    release_id,
    workstream_id,
    item_type,
    title,
    description,
    stage,
    priority,
    external_ref,
    metadata,
    created_by
  ) values (
    p_release_id,
    null,
    'evidence',
    pg_catalog.btrim(p_title),
    nullif(p_description, ''),
    'verification',
    'p2',
    nullif(p_external_ref, ''),
    p_metadata,
    p_actor_user_id
  )
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
    'evidence_registered',
    'evidence',
    result.id,
    null,
    jsonb_build_object(
      'id', result.id,
      'release_id', result.release_id,
      'title', result.title,
      'external_ref', result.external_ref,
      'fingerprint', fingerprint,
      'kind', p_metadata->>'kind'
    ),
    jsonb_build_object(
      'actor_role', p_actor_role,
      'release_stage', release_row.stage,
      'release_version', release_row.release_version,
      'privileged_write', true,
      'atomic_write', true
    )
  );

  return result;
end;
$$;

revoke all on function public.register_control_tower_evidence_server(uuid, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.register_control_tower_evidence_server(uuid, text, text, text, jsonb, uuid, text) to service_role;
