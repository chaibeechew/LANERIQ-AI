create table if not exists public.game_forge_blueprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 160 and request_id ~ '^[A-Za-z0-9._:-]+$'),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('weapon','item','treasure','skill','magic','kungfu','ultimate','defense','healing','buff','debuff','summon','transformation','character_build','combat_balance')),
  prompt text not null check (char_length(prompt) between 1 and 2400),
  blueprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index if not exists game_forge_blueprints_user_created_idx on public.game_forge_blueprints(user_id,created_at desc);
alter table public.game_forge_blueprints enable row level security;
revoke all on table public.game_forge_blueprints from anon;
grant select,insert,update,delete on table public.game_forge_blueprints to authenticated;
drop policy if exists game_forge_blueprints_owner_select on public.game_forge_blueprints;
create policy game_forge_blueprints_owner_select on public.game_forge_blueprints for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists game_forge_blueprints_owner_insert on public.game_forge_blueprints;
create policy game_forge_blueprints_owner_insert on public.game_forge_blueprints for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists game_forge_blueprints_owner_update on public.game_forge_blueprints;
create policy game_forge_blueprints_owner_update on public.game_forge_blueprints for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists game_forge_blueprints_owner_delete on public.game_forge_blueprints;
create policy game_forge_blueprints_owner_delete on public.game_forge_blueprints for delete to authenticated using (user_id=(select auth.uid()));
