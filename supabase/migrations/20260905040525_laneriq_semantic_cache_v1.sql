create table if not exists public.laneriq_semantic_cache (
  scope_hash text not null,
  purpose text not null,
  exact_hash text not null,
  reuse_class text not null default 'private_result',
  result text not null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope_hash, purpose, exact_hash),
  constraint laneriq_semantic_cache_scope_hash_ck check (scope_hash ~ '^[a-f0-9]{64}$'),
  constraint laneriq_semantic_cache_exact_hash_ck check (exact_hash ~ '^[a-f0-9]{64}$'),
  constraint laneriq_semantic_cache_purpose_ck check (char_length(purpose) between 1 and 80),
  constraint laneriq_semantic_cache_reuse_class_ck check (reuse_class in ('private_result','blueprint')),
  constraint laneriq_semantic_cache_result_size_ck check (octet_length(result) <= 1000000),
  constraint laneriq_semantic_cache_ttl_ck check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index if not exists laneriq_semantic_cache_expires_at_idx
  on public.laneriq_semantic_cache (expires_at);

alter table public.laneriq_semantic_cache enable row level security;

revoke all on table public.laneriq_semantic_cache from anon, authenticated;
grant select, insert, update, delete on table public.laneriq_semantic_cache to service_role;

comment on table public.laneriq_semantic_cache is
  'LANERIQ L0 persistent exact semantic reuse cache. Stores hashed scope/fingerprint and bounded result only; raw prompts are forbidden by application contract.';
