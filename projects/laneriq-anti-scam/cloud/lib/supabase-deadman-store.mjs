import { assertPrivacyMinimalDeadManRecord } from './cloud-deadman.mjs';

function configured({ supabaseUrl, serviceRoleKey }) {
  if (!supabaseUrl || !/^https:\/\//.test(supabaseUrl)) throw new Error('SUPABASE_URL_NOT_CONFIGURED');
  if (!serviceRoleKey || String(serviceRoleKey).length < 32) throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
}

export async function upsertDeadManRecord(record, {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  assertPrivacyMinimalDeadManRecord(record);
  configured({ supabaseUrl, serviceRoleKey });

  const response = await fetchImpl(new URL('/rest/v1/rpc/upsert_anti_scam_guardian_lease', supabaseUrl), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify({
      p_device_pseudonym: record.devicePseudonym,
      p_lease_epoch: record.leaseEpoch,
      p_heartbeat_sequence: record.heartbeatSequence,
      p_lease_expires_at_ms: record.leaseExpiresAtMs,
      p_integrity_state: record.integrityState,
      p_emergency_level: record.emergencyLevel,
      p_alert_delivery_state: record.alertDeliveryState,
      p_policy_version: record.policyVersion,
      p_observed_at_ms: record.observedAtMs,
      p_received_at_ms: record.receivedAtMs,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`DEADMAN_STORE_HTTP_${response.status}`);
  const body = await response.json();
  const accepted = body === true || (Array.isArray(body) && body[0] === true);
  if (!accepted) throw new Error('DEADMAN_REPLAY_OR_STORE_REJECTED');
  return true;
}

export async function readDeadManRecord(devicePseudonym, {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  configured({ supabaseUrl, serviceRoleKey });
  if (!/^[0-9a-f]{64}$/.test(String(devicePseudonym || ''))) throw new Error('INVALID_DEVICE_PSEUDONYM');

  const url = new URL('/rest/v1/anti_scam_guardian_leases', supabaseUrl);
  url.searchParams.set('device_pseudonym', `eq.${devicePseudonym}`);
  url.searchParams.set('select', 'device_pseudonym,lease_epoch,heartbeat_sequence,lease_expires_at_ms,integrity_state,emergency_level,alert_delivery_state,policy_version,observed_at_ms,received_at_ms');
  url.searchParams.set('limit', '1');
  const response = await fetchImpl(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      accept: 'application/json',
      'cache-control': 'no-store',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`DEADMAN_READ_HTTP_${response.status}`);
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return Object.freeze({
    schema: 1,
    devicePseudonym: row.device_pseudonym,
    leaseEpoch: Number(row.lease_epoch),
    heartbeatSequence: Number(row.heartbeat_sequence),
    leaseExpiresAtMs: Number(row.lease_expires_at_ms),
    integrityState: row.integrity_state,
    emergencyLevel: row.emergency_level,
    alertDeliveryState: row.alert_delivery_state,
    policyVersion: row.policy_version,
    observedAtMs: Number(row.observed_at_ms),
    receivedAtMs: Number(row.received_at_ms),
  });
}
