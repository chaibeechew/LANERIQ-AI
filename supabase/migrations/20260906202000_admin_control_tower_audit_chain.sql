-- Tamper-evident, append-only Control Tower audit chain.

create extension if not exists pgcrypto;

alter table public.control_tower_audit_log
  add column if not exists prev_hash text,
  add column if not exists event_hash text;

create unique index if not exists control_tower_audit_event_hash_idx
  on public.control_tower_audit_log(event_hash)
  where event_hash is not null;

create or replace function public.control_tower_seal_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_hash text;
  canonical_payload text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('laneriq-control-tower-audit-chain'));

  select a.event_hash into previous_hash
  from public.control_tower_audit_log a
  where a.event_hash is not null
  order by a.created_at desc, a.id desc
  limit 1;

  new.prev_hash := previous_hash;
  canonical_payload := concat_ws('|',
    coalesce(previous_hash, ''),
    new.id::text,
    new.actor_user_id::text,
    new.action,
    new.entity_type,
    coalesce(new.entity_id::text, ''),
    coalesce(new.before_state::text, ''),
    coalesce(new.after_state::text, ''),
    coalesce(new.metadata::text, '{}'),
    new.created_at::text
  );
  new.event_hash := encode(public.digest(convert_to(canonical_payload, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

revoke all on function public.control_tower_seal_audit_event() from public, anon, authenticated;

create trigger control_tower_audit_seal
before insert on public.control_tower_audit_log
for each row execute function public.control_tower_seal_audit_event();

create or replace function public.append_control_tower_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.control_tower_audit_log
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.control_tower_audit_log;
begin
  if not public.is_control_tower_admin() then
    raise exception 'Control Tower access required'
      using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_action), '') is null or length(p_action) > 120 then
    raise exception 'Invalid Control Tower audit action'
      using errcode = 'invalid_parameter_value';
  end if;
  if nullif(btrim(p_entity_type), '') is null or length(p_entity_type) > 120 then
    raise exception 'Invalid Control Tower audit entity type'
      using errcode = 'invalid_parameter_value';
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
    auth.uid(),
    btrim(p_action),
    btrim(p_entity_type),
    p_entity_id,
    p_before_state,
    p_after_state,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into result;

  return result;
end;
$$;

revoke insert on public.control_tower_audit_log from authenticated;
revoke all on function public.append_control_tower_audit(text, text, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.append_control_tower_audit(text, text, uuid, jsonb, jsonb, jsonb) to authenticated;
