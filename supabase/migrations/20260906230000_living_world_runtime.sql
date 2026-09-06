-- LANERIQ AI Living World Runtime V1.
-- Owner-scoped persistent world state, event history, relationship links, Living Avatar profiles
-- and privacy-safe originality signatures. Structured runtime data is not proof of rendered 3D/physics/video.

alter table public.game_worlds drop constraint if exists game_worlds_type_check;
alter table public.game_worlds add constraint game_worlds_type_check check (world_type in ('city','island','fantasy','space','dungeon','battle_zone','mission_zone','simulation','property','business','adventure'));

create table if not exists public.living_world_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 160 and request_id ~ '^[A-Za-z0-9._:-]+$'),
  name text not null check (char_length(name) between 1 and 120),
  world_id uuid references public.game_worlds(id) on delete set null,
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest)='object'),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state)='object'),
  revision bigint not null default 0 check (revision >= 0),
  originality jsonb not null default '{}'::jsonb check (jsonb_typeof(originality)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index if not exists living_world_projects_user_created_idx on public.living_world_projects(user_id,created_at desc);
create index if not exists living_world_projects_world_idx on public.living_world_projects(user_id,world_id);

create table if not exists public.living_world_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.living_world_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 160 and event_key ~ '^[A-Za-z0-9._:-]+$'),
  event_type text not null check (event_type in ('move','enter_location','complete_quest','defeat_boss','equip_asset','unequip_asset','set_flag','relationship_delta','story_fact','unlock_gate','vehicle_board','vehicle_exit','world_tick')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(),
  unique(project_id,event_key)
);
create index if not exists living_world_events_project_created_idx on public.living_world_events(project_id,created_at);

create table if not exists public.living_world_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.living_world_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_type text not null check (char_length(from_type) between 1 and 60),
  from_ref text not null check (char_length(from_ref) between 1 and 180),
  relation text not null check (char_length(relation) between 1 and 80),
  to_type text not null check (char_length(to_type) between 1 and 60),
  to_ref text not null check (char_length(to_ref) between 1 and 180),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  unique(project_id,from_type,from_ref,relation,to_type,to_ref)
);
create index if not exists living_world_links_project_idx on public.living_world_links(project_id);

create table if not exists public.living_avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 160 and request_id ~ '^[A-Za-z0-9._:-]+$'),
  name text not null check (char_length(name) between 1 and 120),
  avatar_asset_id uuid references public.asset_library(id) on delete set null,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile)='object'),
  consent jsonb not null default '{}'::jsonb check (jsonb_typeof(consent)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index if not exists living_avatar_profiles_user_created_idx on public.living_avatar_profiles(user_id,created_at desc);

create table if not exists public.living_world_originality_signatures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.living_world_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_kind text not null check (content_kind in ('living_world','story','quest','combat','demo')),
  signature_hash text not null check (signature_hash ~ '^[0-9a-f]{64}$'),
  sketch jsonb not null default '[]'::jsonb check (jsonb_typeof(sketch)='array'),
  created_at timestamptz not null default now(),
  unique(user_id,content_kind,signature_hash)
);
create index if not exists living_world_originality_user_idx on public.living_world_originality_signatures(user_id,created_at desc);

alter table public.living_world_projects enable row level security;
alter table public.living_world_events enable row level security;
alter table public.living_world_links enable row level security;
alter table public.living_avatar_profiles enable row level security;
alter table public.living_world_originality_signatures enable row level security;

revoke all on table public.living_world_projects, public.living_world_events, public.living_world_links, public.living_avatar_profiles, public.living_world_originality_signatures from public, anon;
grant select,insert,update,delete on table public.living_world_projects, public.living_world_events, public.living_world_links, public.living_avatar_profiles, public.living_world_originality_signatures to authenticated;

drop policy if exists living_world_projects_owner on public.living_world_projects;
create policy living_world_projects_owner on public.living_world_projects for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists living_world_events_owner on public.living_world_events;
create policy living_world_events_owner on public.living_world_events for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists living_world_links_owner on public.living_world_links;
create policy living_world_links_owner on public.living_world_links for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists living_avatar_profiles_owner on public.living_avatar_profiles;
create policy living_avatar_profiles_owner on public.living_avatar_profiles for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists living_world_originality_owner on public.living_world_originality_signatures;
create policy living_world_originality_owner on public.living_world_originality_signatures for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
