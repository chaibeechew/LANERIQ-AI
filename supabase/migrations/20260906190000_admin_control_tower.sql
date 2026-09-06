-- LANERIQ AI Admin Control Tower
-- Internal-only program, release, workstream, gate and evidence management.
-- This migration is safe to stage in a feature branch; do not treat it as Production until normal release gates pass.

create or replace function public.is_control_tower_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->>'role') in ('owner', 'super_admin', 'admin'),
    false
  );
$$;

revoke all on function public.is_control_tower_admin() from public, anon;
grant execute on function public.is_control_tower_admin() to authenticated;

create table if not exists public.control_tower_releases (
  id uuid primary key default gen_random_uuid(),
  product_version text not null,
  release_version text not null unique,
  capability_layer text,
  release_status text not null default 'backlog'
    check (release_status in ('active', 'next', 'backlog', 'archived')),
  stage text not null default 'planned'
    check (stage in ('idea','planned','ready','in_progress','code_complete','verification','release_candidate','production','observed','closed')),
  target_platforms text[] not null default '{}'::text[],
  release_notes text,
  target_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.control_tower_workstreams (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.control_tower_releases(id) on delete cascade,
  workstream_key text not null,
  name text not null,
  description text,
  stage text not null default 'planned'
    check (stage in ('idea','planned','ready','in_progress','code_complete','verification','release_candidate','production','observed','closed')),
  owner_user_id uuid,
  dependencies jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, workstream_key)
);

create table if not exists public.control_tower_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.control_tower_releases(id) on delete cascade,
  workstream_id uuid references public.control_tower_workstreams(id) on delete set null,
  item_type text not null
    check (item_type in ('epic','feature','task','pr','dependency','risk','decision','deprecation','evidence')),
  title text not null,
  description text,
  stage text not null default 'planned'
    check (stage in ('idea','planned','ready','in_progress','code_complete','verification','release_candidate','production','observed','closed')),
  priority text not null default 'p2' check (priority in ('p0','p1','p2','p3')),
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.control_tower_release_gates (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.control_tower_releases(id) on delete cascade,
  gate_key text not null,
  label text not null,
  state text not null default 'pending' check (state in ('pending','pass','fail','waived')),
  required boolean not null default true,
  detail text,
  evidence jsonb not null default '{}'::jsonb,
  checked_by uuid,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, gate_key)
);

create table if not exists public.control_tower_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null default auth.uid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists control_tower_releases_status_stage_idx
  on public.control_tower_releases(release_status, stage);
create unique index if not exists control_tower_single_active_release_idx
  on public.control_tower_releases ((release_status))
  where release_status = 'active';
create index if not exists control_tower_workstreams_release_stage_idx
  on public.control_tower_workstreams(release_id, stage);
create index if not exists control_tower_items_release_stage_idx
  on public.control_tower_items(release_id, stage);
create index if not exists control_tower_items_workstream_type_idx
  on public.control_tower_items(workstream_id, item_type);
create index if not exists control_tower_release_gates_release_state_idx
  on public.control_tower_release_gates(release_id, state);
create index if not exists control_tower_audit_log_entity_idx
  on public.control_tower_audit_log(entity_type, entity_id, created_at desc);

create or replace function public.control_tower_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
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
begin
  if new.stage = old.stage then return new; end if;
  old_index := array_position(stages, old.stage);
  new_index := array_position(stages, new.stage);
  if new_index = old_index + 1 then return new; end if;
  if new_index = old_index - 1 and old.stage not in ('production','observed','closed') then return new; end if;
  raise exception 'Invalid Control Tower release stage transition: % -> %', old.stage, new.stage
    using errcode = 'check_violation';
end;
$$;

create or replace function public.control_tower_guard_workstream_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_stage text;
  target_release uuid;
begin
  target_release := coalesce(new.release_id, old.release_id);
  select r.stage into release_stage from public.control_tower_releases r where r.id = target_release;
  if release_stage in ('release_candidate','production','observed','closed') then
    raise exception 'Control Tower release is frozen at stage %', release_stage
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  return coalesce(new, old);
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
  target_release := coalesce(new.release_id, old.release_id);
  target_type := coalesce(new.item_type, old.item_type);
  select r.stage into release_stage from public.control_tower_releases r where r.id = target_release;
  if release_stage in ('release_candidate','production','observed','closed') and target_type not in ('evidence','decision') then
    raise exception 'Control Tower release is frozen at stage %; only evidence/decision append activity is allowed', release_stage
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.control_tower_reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Control Tower audit log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.control_tower_set_updated_at() from public, anon, authenticated;
revoke all on function public.control_tower_guard_release_stage_transition() from public, anon, authenticated;
revoke all on function public.control_tower_guard_workstream_mutation() from public, anon, authenticated;
revoke all on function public.control_tower_guard_item_mutation() from public, anon, authenticated;
revoke all on function public.control_tower_reject_audit_mutation() from public, anon, authenticated;

create trigger control_tower_releases_updated_at
before update on public.control_tower_releases
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_release_stage_guard
before update of stage on public.control_tower_releases
for each row execute function public.control_tower_guard_release_stage_transition();

create trigger control_tower_workstreams_updated_at
before update on public.control_tower_workstreams
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_workstreams_freeze_guard
before insert or update or delete on public.control_tower_workstreams
for each row execute function public.control_tower_guard_workstream_mutation();

create trigger control_tower_items_updated_at
before update on public.control_tower_items
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_items_freeze_guard
before insert or update or delete on public.control_tower_items
for each row execute function public.control_tower_guard_item_mutation();

create trigger control_tower_release_gates_updated_at
before update on public.control_tower_release_gates
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_audit_immutable
before update or delete on public.control_tower_audit_log
for each row execute function public.control_tower_reject_audit_mutation();

alter table public.control_tower_releases enable row level security;
alter table public.control_tower_workstreams enable row level security;
alter table public.control_tower_items enable row level security;
alter table public.control_tower_release_gates enable row level security;
alter table public.control_tower_audit_log enable row level security;

create policy control_tower_releases_admin_all
on public.control_tower_releases
for all to authenticated
using (public.is_control_tower_admin())
with check (public.is_control_tower_admin());

create policy control_tower_workstreams_admin_all
on public.control_tower_workstreams
for all to authenticated
using (public.is_control_tower_admin())
with check (public.is_control_tower_admin());

create policy control_tower_items_admin_all
on public.control_tower_items
for all to authenticated
using (public.is_control_tower_admin())
with check (public.is_control_tower_admin());

create policy control_tower_release_gates_admin_all
on public.control_tower_release_gates
for all to authenticated
using (public.is_control_tower_admin())
with check (public.is_control_tower_admin());

create policy control_tower_audit_log_admin_read
on public.control_tower_audit_log
for select to authenticated
using (public.is_control_tower_admin());

create policy control_tower_audit_log_admin_insert
on public.control_tower_audit_log
for insert to authenticated
with check (public.is_control_tower_admin() and actor_user_id = auth.uid());

revoke all on public.control_tower_releases from anon;
revoke all on public.control_tower_workstreams from anon;
revoke all on public.control_tower_items from anon;
revoke all on public.control_tower_release_gates from anon;
revoke all on public.control_tower_audit_log from anon;

grant select, insert, update, delete on public.control_tower_releases to authenticated;
grant select, insert, update, delete on public.control_tower_workstreams to authenticated;
grant select, insert, update, delete on public.control_tower_items to authenticated;
grant select, insert, update, delete on public.control_tower_release_gates to authenticated;
grant select, insert on public.control_tower_audit_log to authenticated;
