-- LANERIQ AI Map -> Avatar -> Super Game owner-scoped semantic world storage.
-- Saved worlds contain generated planning metadata only. They are not proof of live geospatial data.

create table if not exists public.game_worlds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  name text not null,
  mode text not null default 'game_world',
  prompt text not null,
  world_type text not null,
  style text not null,
  scale text not null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_worlds_request_id_check check (char_length(request_id) between 1 and 160 and request_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint game_worlds_name_check check (char_length(name) between 1 and 120),
  constraint game_worlds_prompt_check check (char_length(prompt) between 1 and 4000),
  constraint game_worlds_mode_check check (mode in ('game_world','real_world')),
  constraint game_worlds_type_check check (world_type in ('city','island','fantasy','space','battle_zone','property','business','adventure')),
  constraint game_worlds_style_check check (style in ('cinematic','futuristic','realistic','fantasy','minimal','tactical')),
  constraint game_worlds_scale_check check (scale in ('compact','district','open_world')),
  constraint game_worlds_manifest_object_check check (jsonb_typeof(manifest) = 'object'),
  constraint game_worlds_user_request_unique unique (user_id, request_id)
);

create index if not exists game_worlds_user_created_idx on public.game_worlds(user_id, created_at desc);

alter table public.game_worlds enable row level security;
revoke all on table public.game_worlds from public, anon;
grant select, insert, update, delete on table public.game_worlds to authenticated;

drop policy if exists game_worlds_select_own on public.game_worlds;
create policy game_worlds_select_own on public.game_worlds for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists game_worlds_insert_own on public.game_worlds;
create policy game_worlds_insert_own on public.game_worlds for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists game_worlds_update_own on public.game_worlds;
create policy game_worlds_update_own on public.game_worlds for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists game_worlds_delete_own on public.game_worlds;
create policy game_worlds_delete_own on public.game_worlds for delete to authenticated
using (user_id = (select auth.uid()));
