-- Keep existing app_metadata.role compatible with legacy admin surfaces while allowing
-- an independent app_metadata.control_tower_role for Owner / Super Admin authority.

create or replace function public.is_control_tower_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    coalesce(
      auth.jwt()->'app_metadata'->>'control_tower_role',
      auth.jwt()->'app_metadata'->>'role'
    ) in ('owner', 'super_admin', 'admin'),
    false
  );
$$;

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
begin
  if new.stage = old.stage then return new; end if;
  old_index := array_position(stages, old.stage);
  new_index := array_position(stages, new.stage);
  actor_role := coalesce(
    auth.jwt()->'app_metadata'->>'control_tower_role',
    auth.jwt()->'app_metadata'->>'role',
    ''
  );

  if new.stage = 'production' and actor_role not in ('owner','super_admin') then
    raise exception 'Owner or Super Admin authority required for Production promotion'
      using errcode = 'insufficient_privilege';
  end if;

  if new_index = old_index + 1 then return new; end if;
  if new_index = old_index - 1 and old.stage not in ('production','observed','closed') then return new; end if;

  raise exception 'Invalid Control Tower release stage transition: % -> %', old.stage, new.stage
    using errcode = 'check_violation';
end;
$$;

create or replace function public.control_tower_guard_gate_authority()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role text;
  production_gate boolean;
  non_waivable boolean;
begin
  actor_role := coalesce(
    auth.jwt()->'app_metadata'->>'control_tower_role',
    auth.jwt()->'app_metadata'->>'role',
    ''
  );
  production_gate := new.gate_key in ('github-main','runtime-identity','exact-sha','supabase');
  non_waivable := new.gate_key in ('ci','security','database','github-main','runtime-identity','exact-sha','supabase');

  if tg_op = 'INSERT' and production_gate and new.state <> 'pending' then
    raise exception 'Production identity gates must initialize as pending'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and production_gate and new.state is distinct from old.state then
    raise exception 'Production identity gate state is system-managed from live release truth'
      using errcode = 'insufficient_privilege';
  end if;

  if new.state = 'waived' and non_waivable then
    raise exception 'This Control Tower gate cannot be waived'
      using errcode = 'check_violation';
  end if;

  if new.state = 'waived' and actor_role not in ('owner','super_admin') then
    raise exception 'Owner or Super Admin authority required for gate waiver'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.is_control_tower_admin() from public, anon;
grant execute on function public.is_control_tower_admin() to authenticated;
revoke all on function public.control_tower_guard_release_stage_transition() from public, anon, authenticated;
revoke all on function public.control_tower_guard_gate_authority() from public, anon, authenticated;
