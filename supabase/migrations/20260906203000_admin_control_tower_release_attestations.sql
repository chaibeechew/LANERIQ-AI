-- Immutable release attestations sealed only after technical-ceiling verification.

create table if not exists public.control_tower_release_attestations (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.control_tower_releases(id) on delete restrict,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  algorithm text not null default 'sha256' check (algorithm = 'sha256'),
  manifest jsonb not null,
  technical_ceiling jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (release_id, digest)
);

create index if not exists control_tower_release_attestations_release_created_idx
  on public.control_tower_release_attestations(release_id, created_at desc);

alter table public.control_tower_release_attestations enable row level security;

revoke insert, update, delete on public.control_tower_release_attestations from authenticated;
grant select on public.control_tower_release_attestations to authenticated;

drop policy if exists control_tower_release_attestations_select on public.control_tower_release_attestations;
create policy control_tower_release_attestations_select
  on public.control_tower_release_attestations
  for select
  to authenticated
  using (public.is_control_tower_admin());

create or replace function public.control_tower_attestation_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Control Tower release attestations are immutable'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.control_tower_attestation_immutable() from public, anon, authenticated;

drop trigger if exists control_tower_release_attestation_immutable on public.control_tower_release_attestations;
create trigger control_tower_release_attestation_immutable
before update or delete on public.control_tower_release_attestations
for each row execute function public.control_tower_attestation_immutable();

create or replace function public.append_control_tower_release_attestation(
  p_release_id uuid,
  p_digest text,
  p_manifest jsonb,
  p_technical_ceiling jsonb default '{}'::jsonb
)
returns public.control_tower_release_attestations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  release_stage text;
  result public.control_tower_release_attestations;
begin
  actor_role := coalesce(
    auth.jwt()->'app_metadata'->>'control_tower_role',
    auth.jwt()->'app_metadata'->>'role',
    ''
  );

  if actor_role not in ('owner', 'super_admin') then
    raise exception 'Owner or Super Admin authority required to seal a release attestation'
      using errcode = 'insufficient_privilege';
  end if;

  if auth.uid() is null then
    raise exception 'Authenticated actor required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid SHA-256 release attestation digest'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' then
    raise exception 'Release attestation manifest must be a JSON object'
      using errcode = 'invalid_parameter_value';
  end if;

  select r.stage into release_stage
  from public.control_tower_releases r
  where r.id = p_release_id
  for update;

  if release_stage is null then
    raise exception 'Release does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  if release_stage not in ('release_candidate', 'production', 'observed') then
    raise exception 'Release attestation may only be sealed at RC or later'
      using errcode = 'check_violation';
  end if;

  insert into public.control_tower_release_attestations(
    release_id,
    digest,
    algorithm,
    manifest,
    technical_ceiling,
    actor_user_id
  ) values (
    p_release_id,
    p_digest,
    'sha256',
    p_manifest,
    coalesce(p_technical_ceiling, '{}'::jsonb),
    auth.uid()
  )
  on conflict (release_id, digest) do nothing
  returning * into result;

  if result.id is null then
    select * into result
    from public.control_tower_release_attestations a
    where a.release_id = p_release_id and a.digest = p_digest
    limit 1;
  else
    perform public.append_control_tower_audit(
      'release_attestation_sealed',
      'release',
      p_release_id,
      null,
      jsonb_build_object('digest', p_digest, 'algorithm', 'sha256'),
      jsonb_build_object('attestation_id', result.id, 'technical_ceiling', coalesce(p_technical_ceiling, '{}'::jsonb))
    );
  end if;

  return result;
end;
$$;

revoke all on function public.append_control_tower_release_attestation(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.append_control_tower_release_attestation(uuid, text, jsonb, jsonb) to authenticated;
