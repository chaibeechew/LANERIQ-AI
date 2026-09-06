-- Atomically apply one owner-scoped Living World state transition and append its event.
create or replace function public.server_apply_living_world_event(
  p_project_id uuid,
  p_expected_revision bigint,
  p_event_key text,
  p_event_type text,
  p_payload jsonb,
  p_next_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.living_world_projects%rowtype;
  v_event public.living_world_events%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event_key is null or char_length(p_event_key)<1 or char_length(p_event_key)>160 or p_event_key !~ '^[A-Za-z0-9._:-]+$' then raise exception 'EVENT_KEY_INVALID'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_next_state,'{}'::jsonb)) <> 'object' then raise exception 'EVENT_PAYLOAD_INVALID'; end if;

  select * into v_project from public.living_world_projects where id=p_project_id and user_id=v_user_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  select * into v_event from public.living_world_events where project_id=p_project_id and user_id=v_user_id and event_key=p_event_key;
  if found then return jsonb_build_object('replayed',true,'project',to_jsonb(v_project),'event',to_jsonb(v_event)); end if;
  if v_project.revision <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;

  update public.living_world_projects
  set state=p_next_state, revision=p_expected_revision+1, updated_at=now()
  where id=p_project_id and user_id=v_user_id
  returning * into v_project;

  insert into public.living_world_events(project_id,user_id,event_key,event_type,payload)
  values(p_project_id,v_user_id,p_event_key,p_event_type,coalesce(p_payload,'{}'::jsonb))
  returning * into v_event;

  return jsonb_build_object('replayed',false,'project',to_jsonb(v_project),'event',to_jsonb(v_event));
end;
$$;

revoke all on function public.server_apply_living_world_event(uuid,bigint,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.server_apply_living_world_event(uuid,bigint,text,text,jsonb,jsonb) to authenticated;
