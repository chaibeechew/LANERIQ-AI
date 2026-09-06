create table if not exists public.production_e2e_evidence_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  commit_ref text not null check (commit_ref = 'main'),
  environment text not null check (environment = 'production'),
  evidence_level text not null default 'AUTHENTICATED_PRODUCTION_APP_BUILDER_FULL_CLOSURE_V3',
  status text not null default 'running' check (status in ('running','failed','passed')),
  highest_stage smallint not null default 0 check (highest_stage between 0 and 18),
  app_id uuid,
  initial_version_id uuid,
  modified_version_id uuid,
  current_version_id uuid,
  workflow_id uuid,
  stage_evidence jsonb not null default '{}'::jsonb,
  report_digest text check (report_digest is null or report_digest ~ '^[0-9a-f]{64}$'),
  failure_stage smallint check (failure_stage is null or failure_stage between 0 and 18),
  failure_code text,
  failure_message text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists production_e2e_evidence_runs_commit_status_idx
  on public.production_e2e_evidence_runs (commit_sha, status, completed_at desc);
create index if not exists production_e2e_evidence_runs_user_started_idx
  on public.production_e2e_evidence_runs (user_id, started_at desc);

alter table public.production_e2e_evidence_runs enable row level security;
revoke all on table public.production_e2e_evidence_runs from public, anon, authenticated;
grant select, insert, update on table public.production_e2e_evidence_runs to service_role;

comment on table public.production_e2e_evidence_runs is
  'Server-only, privacy-bounded ledger for authenticated LANERIQ Production App Builder closure evidence. No raw prompts, credentials, provider secrets, user email, or external message contents.';
