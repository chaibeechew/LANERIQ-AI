begin;

create table if not exists public.living_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  manifest jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  persistent_memory_opt_in boolean not null default false,
  memory_binding_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint living_characters_character_id_length check (char_length(character_id) between 1 and 96),
  constraint living_characters_character_id_format check (character_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint living_characters_manifest_object check (jsonb_typeof(manifest) = 'object'),
  constraint living_characters_manifest_size check (octet_length(manifest::text) <= 32768),
  constraint living_characters_revision_positive check (revision >= 1),
  constraint living_characters_memory_binding_length check (memory_binding_id is null or char_length(memory_binding_id) <= 160),
  unique (user_id, character_id)
);

create table if not exists public.living_character_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  device_id_hash text not null,
  device_class text not null default 'unknown',
  continuity_snapshot jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint living_character_devices_character_id_length check (char_length(character_id) between 1 and 96),
  constraint living_character_devices_device_hash check (device_id_hash ~ '^[a-f0-9]{64}$'),
  constraint living_character_devices_class_length check (char_length(device_class) between 1 and 40),
  constraint living_character_devices_snapshot_object check (jsonb_typeof(continuity_snapshot) = 'object'),
  constraint living_character_devices_snapshot_size check (octet_length(continuity_snapshot::text) <= 16384),
  constraint living_character_devices_revision_nonnegative check (revision >= 0),
  unique (user_id, character_id, device_id_hash)
);

create index if not exists living_characters_user_updated_idx on public.living_characters (user_id, updated_at desc);
create index if not exists living_character_devices_user_character_seen_idx on public.living_character_devices (user_id, character_id, last_seen_at desc);

alter table public.living_characters enable row level security;
alter table public.living_character_devices enable row level security;
alter table public.living_characters force row level security;
alter table public.living_character_devices force row level security;

revoke all on table public.living_characters from public, anon, authenticated;
revoke all on table public.living_character_devices from public, anon, authenticated;
grant select, insert, update, delete on table public.living_characters to service_role;
grant select, insert, update, delete on table public.living_character_devices to service_role;

comment on table public.living_characters is 'Service-role-only owner-scoped LANERIQ Living Character manifests. Persistent memory contents are not stored here.';
comment on table public.living_character_devices is 'Service-role-only pseudonymous device continuity snapshots. Raw device identifiers, raw assets and memory contents are forbidden.';

commit;
