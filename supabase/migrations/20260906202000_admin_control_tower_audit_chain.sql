-- Tamper-evident, append-only Control Tower audit chain.
-- pgcrypto is already installed in Supabase's extensions schema in the active LANERIQ project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
  canonical_payload := pg_catalog.concat_ws('|',
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
  new.event_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(canonical_payload, 'UTF8'), 'sha256'),
    'hex'
  );
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
  if nullif(pg_catalog.btrim(p_action), '') is null or length(p_action) > 120 then
    raise exception 'Invalid Control Tower audit action'
      using errcode = 'invalid_parameter_value';
  end if;
  if nullif(pg_catalog.btrim(p_entity_type), '') is null or length(p_entity_type) > 120 then
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
    pg_catalog.btrim(p_action),
    pg_catalog.btrim(p_entity_type),
    p_entity_id,
    p_before_state,
    p_after_state,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into result;

  return result;
end;
$$;

create or replace function public.verify_control_tower_audit_chain()
returns table(
  valid boolean,
  checked_count bigint,
  first_invalid_id uuid,
  head_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  previous_hash text := null;
  expected_hash text;
  canonical_payload text;
  checked bigint := 0;
begin
  if not public.is_control_tower_admin() then
    raise exception 'Control Tower access required'
      using errcode = 'insufficient_privilege';
  end if;

  for rec in
    select a.id, a.actor_user_id, a.action, a.entity_type, a.entity_id,
           a.before_state, a.after_state, a.metadata, a.created_at,
           a.prev_hash, a.event_hash
    from public.control_tower_audit_log a
    order by a.created_at asc, a.id asc
  loop
    canonical_payload := pg_catalog.concat_ws('|',
      coalesce(previous_hash, ''),
      rec.id::text,
      rec.actor_user_id::text,
      rec.action,
      rec.entity_type,
      coalesce(rec.entity_id::text, ''),
      coalesce(rec.before_state::text, ''),
      coalesce(rec.after_state::text, ''),
      coalesce(rec.metadata::text, '{}'),
      rec.created_at::text
    );
    expected_hash := pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(canonical_payload, 'UTF8'), 'sha256'),
      'hex'
    );
    checked := checked + 1;

    if rec.prev_hash is distinct from previous_hash or rec.event_hash is distinct from expected_hash then
      return query select false, checked, rec.id, rec.event_hash;
      return;
    end if;

    previous_hash := rec.event_hash;
  end loop;

  return query select true, checked, null::uuid, previous_hash;
end;
$$;

revoke insert on public.control_tower_audit_log from authenticated;
revoke all on function public.append_control_tower_audit(text, text, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.append_control_tower_audit(text, text, uuid, jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.verify_control_tower_audit_chain() from public, anon;
grant execute on function public.verify_control_tower_audit_chain() to authenticated;
