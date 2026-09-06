-- LANERIQ Anti Scam Cloud Dead-Man storage contract.
-- No raw device id, URL, file name, message, contact or screen content is stored.

create table if not exists public.anti_scam_guardian_leases (
  device_pseudonym text primary key check (device_pseudonym ~ '^[0-9a-f]{64}$'),
  lease_epoch bigint not null check (lease_epoch > 0),
  heartbeat_sequence bigint not null check (heartbeat_sequence > 0),
  lease_expires_at_ms bigint not null check (lease_expires_at_ms > 0),
  integrity_state text not null,
  emergency_level text not null,
  alert_delivery_state text not null,
  policy_version text not null,
  observed_at_ms bigint not null check (observed_at_ms > 0),
  received_at_ms bigint not null check (received_at_ms > 0),
  updated_at timestamptz not null default now()
);

alter table public.anti_scam_guardian_leases enable row level security;
revoke all on table public.anti_scam_guardian_leases from anon, authenticated;

create or replace function public.upsert_anti_scam_guardian_lease(
  p_device_pseudonym text,
  p_lease_epoch bigint,
  p_heartbeat_sequence bigint,
  p_lease_expires_at_ms bigint,
  p_integrity_state text,
  p_emergency_level text,
  p_alert_delivery_state text,
  p_policy_version text,
  p_observed_at_ms bigint,
  p_received_at_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.anti_scam_guardian_leases%rowtype;
begin
  if p_device_pseudonym !~ '^[0-9a-f]{64}$'
     or p_lease_epoch <= 0
     or p_heartbeat_sequence <= 0
     or p_observed_at_ms <= 0
     or p_received_at_ms <= 0 then
    return false;
  end if;

  select * into current_row
  from public.anti_scam_guardian_leases
  where device_pseudonym = p_device_pseudonym
  for update;

  if found then
    if p_lease_epoch < current_row.lease_epoch then return false; end if;
    if p_lease_epoch = current_row.lease_epoch
       and p_heartbeat_sequence <= current_row.heartbeat_sequence then return false; end if;
  end if;

  insert into public.anti_scam_guardian_leases (
    device_pseudonym, lease_epoch, heartbeat_sequence, lease_expires_at_ms,
    integrity_state, emergency_level, alert_delivery_state, policy_version,
    observed_at_ms, received_at_ms, updated_at
  ) values (
    p_device_pseudonym, p_lease_epoch, p_heartbeat_sequence, p_lease_expires_at_ms,
    left(p_integrity_state, 64), left(p_emergency_level, 32), left(p_alert_delivery_state, 64), left(p_policy_version, 96),
    p_observed_at_ms, p_received_at_ms, now()
  )
  on conflict (device_pseudonym) do update set
    lease_epoch = excluded.lease_epoch,
    heartbeat_sequence = excluded.heartbeat_sequence,
    lease_expires_at_ms = excluded.lease_expires_at_ms,
    integrity_state = excluded.integrity_state,
    emergency_level = excluded.emergency_level,
    alert_delivery_state = excluded.alert_delivery_state,
    policy_version = excluded.policy_version,
    observed_at_ms = excluded.observed_at_ms,
    received_at_ms = excluded.received_at_ms,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.upsert_anti_scam_guardian_lease(text,bigint,bigint,bigint,text,text,text,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.upsert_anti_scam_guardian_lease(text,bigint,bigint,bigint,text,text,text,text,bigint,bigint) to service_role;

create index if not exists anti_scam_guardian_leases_observed_idx
  on public.anti_scam_guardian_leases (observed_at_ms desc);
