-- LANERIQ Production Evidence Ledger v1
-- Internal, append-only runtime evidence continuity. This is not an external audit log
-- and does not claim a cryptographic signature or independent third-party verification.

create table if not exists public.production_evidence_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  sequence_no bigint not null check (sequence_no > 0),
  attestation_id text not null unique check (attestation_id ~ '^[A-Za-z0-9._:-]{1,160}$'),
  production_sha text not null check (production_sha ~ '^[0-9a-f]{40}$'),
  version_id uuid not null,
  report_hash text not null check (report_hash ~ '^[0-9a-f]{64}$'),
  user_binding_hash text not null check (user_binding_hash ~ '^[0-9a-f]{64}$'),
  session_binding_hash text not null check (session_binding_hash ~ '^[0-9a-f]{64}$'),
  previous_hash text not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  entry_hash text not null unique check (entry_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (project_id, sequence_no)
);

comment on table public.production_evidence_ledger is
  'LANERIQ internal append-only Production attestation receipts. Tamper-evident hash continuity only; not an external audit or signature claim.';

alter table public.production_evidence_ledger enable row level security;

-- No browser role receives direct table access. Server replay is provider-opaque and
-- uses a separately credentialed adapter. The service role can only SELECT directly;
-- appends must go through the constrained RPC below.
revoke all on table public.production_evidence_ledger from anon, authenticated, service_role;
grant select on table public.production_evidence_ledger to service_role;

create or replace function public.block_production_evidence_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'PRODUCTION_EVIDENCE_LEDGER_APPEND_ONLY';
end;
$$;

revoke all on function public.block_production_evidence_ledger_mutation() from public, anon, authenticated, service_role;

drop trigger if exists production_evidence_ledger_immutable on public.production_evidence_ledger;
create trigger production_evidence_ledger_immutable
before update or delete on public.production_evidence_ledger
for each row execute function public.block_production_evidence_ledger_mutation();

create or replace function public.append_production_evidence_ledger(
  p_owner_id uuid,
  p_project_id uuid,
  p_attestation_id text,
  p_production_sha text,
  p_version_id uuid,
  p_report_hash text,
  p_user_binding_hash text,
  p_session_binding_hash text
)
returns table (
  ledger_id uuid,
  ledger_sequence bigint,
  ledger_previous_hash text,
  ledger_entry_hash text,
  ledger_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.production_evidence_ledger%rowtype;
  v_previous_sequence bigint;
  v_previous_hash text;
  v_sequence bigint;
  v_material text;
  v_entry_hash text;
begin
  if p_owner_id is null or p_project_id is null or p_version_id is null then
    raise exception using errcode = '22023', message = 'PRODUCTION_EVIDENCE_IDENTITY_INVALID';
  end if;
  if coalesce(p_attestation_id, '') !~ '^[A-Za-z0-9._:-]{1,160}$' then
    raise exception using errcode = '22023', message = 'PRODUCTION_EVIDENCE_ATTESTATION_ID_INVALID';
  end if;
  if lower(coalesce(p_production_sha, '')) !~ '^[0-9a-f]{40}$'
     or lower(coalesce(p_report_hash, '')) !~ '^[0-9a-f]{64}$'
     or lower(coalesce(p_user_binding_hash, '')) !~ '^[0-9a-f]{64}$'
     or lower(coalesce(p_session_binding_hash, '')) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'PRODUCTION_EVIDENCE_HASH_INVALID';
  end if;

  -- Serialize only this project's evidence chain so simultaneous attestations cannot
  -- fork the previous-hash pointer.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laneriq-production-evidence-ledger-v1:' || p_project_id::text, 0)
  );

  if not exists (
    select 1 from public.apps a where a.id = p_project_id and a.owner_id = p_owner_id
  ) then
    raise exception using errcode = '42501', message = 'PRODUCTION_EVIDENCE_PROJECT_NOT_OWNED';
  end if;

  if not exists (
    select 1 from public.app_versions v where v.id = p_version_id and v.app_id = p_project_id
  ) then
    raise exception using errcode = '23503', message = 'PRODUCTION_EVIDENCE_VERSION_NOT_FOUND';
  end if;

  select l.* into v_existing
  from public.production_evidence_ledger l
  where l.attestation_id = p_attestation_id
  limit 1;

  if found then
    if v_existing.project_id <> p_project_id
       or v_existing.production_sha <> lower(p_production_sha)
       or v_existing.version_id <> p_version_id
       or v_existing.report_hash <> lower(p_report_hash)
       or v_existing.user_binding_hash <> lower(p_user_binding_hash)
       or v_existing.session_binding_hash <> lower(p_session_binding_hash) then
      raise exception using errcode = '23505', message = 'PRODUCTION_EVIDENCE_ATTESTATION_REPLAY_CONFLICT';
    end if;
    return query select
      v_existing.id,
      v_existing.sequence_no,
      v_existing.previous_hash,
      v_existing.entry_hash,
      v_existing.created_at;
    return;
  end if;

  select l.sequence_no, l.entry_hash
    into v_previous_sequence, v_previous_hash
  from public.production_evidence_ledger l
  where l.project_id = p_project_id
  order by l.sequence_no desc
  limit 1;

  v_sequence := coalesce(v_previous_sequence, 0) + 1;
  v_previous_hash := coalesce(v_previous_hash, pg_catalog.repeat('0', 64));

  v_material := pg_catalog.array_to_string(array[
    'laneriq-production-evidence-ledger-v1',
    p_project_id::text,
    v_sequence::text,
    v_previous_hash,
    p_attestation_id,
    lower(p_production_sha),
    p_version_id::text,
    lower(p_report_hash),
    lower(p_user_binding_hash),
    lower(p_session_binding_hash)
  ], E'\n');

  v_entry_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_material, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.production_evidence_ledger (
    project_id,
    sequence_no,
    attestation_id,
    production_sha,
    version_id,
    report_hash,
    user_binding_hash,
    session_binding_hash,
    previous_hash,
    entry_hash
  ) values (
    p_project_id,
    v_sequence,
    p_attestation_id,
    lower(p_production_sha),
    p_version_id,
    lower(p_report_hash),
    lower(p_user_binding_hash),
    lower(p_session_binding_hash),
    v_previous_hash,
    v_entry_hash
  )
  returning * into v_existing;

  return query select
    v_existing.id,
    v_existing.sequence_no,
    v_existing.previous_hash,
    v_existing.entry_hash,
    v_existing.created_at;
end;
$$;

revoke all on function public.append_production_evidence_ledger(uuid, uuid, text, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.append_production_evidence_ledger(uuid, uuid, text, text, uuid, text, text, text)
  to service_role;
