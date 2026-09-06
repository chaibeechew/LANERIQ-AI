begin;

-- LANERIQ Cognitive durability layer.
-- Append-only, owner-scoped evidence. Raw prompts, customer payloads, secrets and source code are not stored here.

create table if not exists public.cognitive_failure_memory (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps(id) on delete cascade,
  owner_id uuid not null,
  scope_key text not null check (char_length(scope_key) between 1 and 200),
  record_id text not null check (record_id ~ '^[a-f0-9]{24}$'),
  category text not null default 'general' check (char_length(category) between 1 and 100),
  failure_code text not null check (char_length(failure_code) between 1 and 120),
  strategy text not null default '' check (char_length(strategy) <= 800),
  repair_pattern text not null default '' check (char_length(repair_pattern) <= 800),
  success_after_repair boolean not null default false,
  provider_class text not null default '' check (char_length(provider_class) <= 80),
  runtime_class text not null default '' check (char_length(runtime_class) <= 80),
  method_digest text not null check (method_digest ~ '^[a-f0-9]{64}$'),
  contains_customer_raw_data boolean not null default false check (contains_customer_raw_data = false),
  contains_secrets boolean not null default false check (contains_secrets = false),
  created_at timestamptz not null default now(),
  unique (owner_id, scope_key, record_id)
);

create index if not exists cognitive_failure_memory_owner_scope_created_idx
  on public.cognitive_failure_memory (owner_id, scope_key, created_at desc);
create index if not exists cognitive_failure_memory_app_created_idx
  on public.cognitive_failure_memory (app_id, created_at desc)
  where app_id is not null;

alter table public.cognitive_failure_memory enable row level security;

drop policy if exists cognitive_failure_memory_select_own on public.cognitive_failure_memory;
create policy cognitive_failure_memory_select_own
  on public.cognitive_failure_memory for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_failure_memory.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists cognitive_failure_memory_insert_own on public.cognitive_failure_memory;
create policy cognitive_failure_memory_insert_own
  on public.cognitive_failure_memory for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and contains_customer_raw_data = false
    and contains_secrets = false
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_failure_memory.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

revoke all on public.cognitive_failure_memory from anon, authenticated;
grant select, insert on public.cognitive_failure_memory to authenticated;
grant all on public.cognitive_failure_memory to service_role;

create table if not exists public.cognitive_event_ledger (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps(id) on delete cascade,
  owner_id uuid not null,
  operation_digest text check (operation_digest is null or operation_digest ~ '^[a-f0-9]{64}$'),
  domain text not null check (char_length(domain) between 1 and 80),
  phase text not null check (char_length(phase) between 1 and 80),
  reasoning_mode text not null check (reasoning_mode in ('fast','deep','council','verified-critical')),
  evidence_class text not null check (evidence_class in ('INTERNAL','SIMULATED','STATIC_PREFLIGHT','MEASURED_OR_ATTESTED','PRODUCTION')),
  council_required boolean not null default false,
  human_approval_required boolean not null default false,
  outcome text not null default 'planned' check (char_length(outcome) between 1 and 80),
  provider_class text not null default '' check (char_length(provider_class) <= 80),
  latency_ms integer not null default 0 check (latency_ms between 0 and 3600000),
  event_digest text not null check (event_digest ~ '^[a-f0-9]{64}$'),
  contains_raw_prompt boolean not null default false check (contains_raw_prompt = false),
  contains_customer_raw_data boolean not null default false check (contains_customer_raw_data = false),
  contains_secrets boolean not null default false check (contains_secrets = false),
  observed_at timestamptz not null default now(),
  unique (owner_id, event_digest)
);

create index if not exists cognitive_event_ledger_owner_observed_idx
  on public.cognitive_event_ledger (owner_id, observed_at desc);
create index if not exists cognitive_event_ledger_app_observed_idx
  on public.cognitive_event_ledger (app_id, observed_at desc)
  where app_id is not null;
create index if not exists cognitive_event_ledger_domain_observed_idx
  on public.cognitive_event_ledger (domain, observed_at desc);

alter table public.cognitive_event_ledger enable row level security;

drop policy if exists cognitive_event_ledger_select_own on public.cognitive_event_ledger;
create policy cognitive_event_ledger_select_own
  on public.cognitive_event_ledger for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_event_ledger.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists cognitive_event_ledger_insert_own on public.cognitive_event_ledger;
create policy cognitive_event_ledger_insert_own
  on public.cognitive_event_ledger for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and contains_raw_prompt = false
    and contains_customer_raw_data = false
    and contains_secrets = false
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_event_ledger.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

revoke all on public.cognitive_event_ledger from anon, authenticated;
grant select, insert on public.cognitive_event_ledger to authenticated;
grant all on public.cognitive_event_ledger to service_role;

create table if not exists public.cognitive_benchmark_evidence (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps(id) on delete cascade,
  owner_id uuid not null,
  campaign_id text not null check (char_length(campaign_id) between 1 and 120),
  case_id text not null check (char_length(case_id) between 1 and 240),
  domain text not null check (char_length(domain) between 1 and 80),
  provider_class text not null check (char_length(provider_class) between 1 and 80),
  model_class text not null default '' check (char_length(model_class) <= 120),
  evidence_class text not null check (evidence_class in ('INTERNAL','SIMULATED','STATIC_PREFLIGHT','MEASURED_OR_ATTESTED','PRODUCTION')),
  score numeric(5,2) not null check (score between 0 and 100),
  passed boolean not null,
  externally_verified boolean not null default false,
  duration_ms integer not null default 0 check (duration_ms between 0 and 3600000),
  prompt_digest text not null check (prompt_digest ~ '^[a-f0-9]{64}$'),
  result_digest text not null check (result_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (evidence_class <> 'PRODUCTION' or externally_verified = true),
  unique (owner_id, campaign_id, case_id, provider_class)
);

create index if not exists cognitive_benchmark_owner_campaign_idx
  on public.cognitive_benchmark_evidence (owner_id, campaign_id, created_at desc);
create index if not exists cognitive_benchmark_app_campaign_idx
  on public.cognitive_benchmark_evidence (app_id, campaign_id, created_at desc)
  where app_id is not null;

alter table public.cognitive_benchmark_evidence enable row level security;

drop policy if exists cognitive_benchmark_select_own on public.cognitive_benchmark_evidence;
create policy cognitive_benchmark_select_own
  on public.cognitive_benchmark_evidence for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_benchmark_evidence.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists cognitive_benchmark_insert_own on public.cognitive_benchmark_evidence;
create policy cognitive_benchmark_insert_own
  on public.cognitive_benchmark_evidence for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (evidence_class <> 'PRODUCTION' or externally_verified = true)
    and (
      app_id is null
      or exists (
        select 1 from public.apps a
        where a.id = cognitive_benchmark_evidence.app_id
          and a.owner_id = (select auth.uid())
      )
    )
  );

revoke all on public.cognitive_benchmark_evidence from anon, authenticated;
grant select, insert on public.cognitive_benchmark_evidence to authenticated;
grant all on public.cognitive_benchmark_evidence to service_role;

commit;
