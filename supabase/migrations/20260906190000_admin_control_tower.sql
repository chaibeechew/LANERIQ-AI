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

revoke all on function public.control_tower_set_updated_at() from public, anon, authenticated;

create trigger control_tower_releases_updated_at
before update on public.control_tower_releases
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_workstreams_updated_at
before update on public.control_tower_workstreams
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_items_updated_at
before update on public.control_tower_items
for each row execute function public.control_tower_set_updated_at();

create trigger control_tower_release_gates_updated_at
before update on public.control_tower_release_gates
for each row execute function public.control_tower_set_updated_at();

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
