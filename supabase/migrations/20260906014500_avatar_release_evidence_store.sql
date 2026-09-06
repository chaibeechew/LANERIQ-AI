begin;

create table if not exists public.avatar_release_evidence (
  evidence_digest text primary key check (evidence_digest ~ '^[a-f0-9]{64}$'),
  release_id text not null check (char_length(release_id) between 1 and 120),
  head_sha text not null check (head_sha ~ '^[a-f0-9]{40}$'),
  build_id text not null check (char_length(build_id) between 1 and 120),
  source_type text not null check (source_type in ('github-ci','vercel-preview','native-host','provider-probe','physical-device-lab','secure-hardware','runtime-probe')),
  capability text not null check (char_length(capability) between 1 and 80),
  issuer_id text not null check (char_length(issuer_id) between 1 and 120),
  probe_id text not null check (char_length(probe_id) between 1 and 120),
  claims jsonb not null default '[]'::jsonb check (jsonb_typeof(claims) = 'array' and pg_column_size(claims) <= 8192),
  observed_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > observed_at),
  status text not null default 'active' check (status in ('active','revoked')),
  revoked_reason text null check (revoked_reason is null or char_length(revoked_reason) <= 160),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  check ((status = 'active' and revoked_at is null) or status = 'revoked')
);

create index if not exists avatar_release_evidence_release_sha_idx on public.avatar_release_evidence (release_id, head_sha, status, observed_at desc);
create index if not exists avatar_release_evidence_capability_idx on public.avatar_release_evidence (capability, source_type, status, expires_at);

alter table public.avatar_release_evidence enable row level security;
alter table public.avatar_release_evidence force row level security;
revoke all on table public.avatar_release_evidence from public, anon, authenticated;
grant select, insert, update on table public.avatar_release_evidence to service_role;

commit;
