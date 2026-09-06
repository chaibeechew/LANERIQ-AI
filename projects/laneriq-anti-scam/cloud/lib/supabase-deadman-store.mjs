import { assertPrivacyMinimalDeadManRecord } from './cloud-deadman.mjs';

export const DEADMAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function configured({ supabaseUrl, serviceRoleKey }) {
  if (!supabaseUrl || !/^https:\/\//.test(supabaseUrl)) throw new Error('SUPABASE_URL_NOT_CONFIGURED');
  if (!serviceRoleKey || String(serviceRoleKey).length < 32) throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
}

function serviceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    accept: 'application/json',
    'cache-control': 'no-store',
  };
}

function normalizePseudonym(devicePseudonym) {
  const value = String(devicePseudonym || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('INVALID_DEVICE_PSEUDONYM');
  return value;
}

export function retentionCutoffMs(nowMs = Date.now(), retentionMs = DEADMAN_RETENTION_MS) {
  const now = Number(nowMs);
  const retention = Number(retentionMs);
  if (!Number.isFinite(now) || now <= 0) throw new Error('INVALID_RETENTION_NOW');
  if (!Number.isFinite(retention) || retention < MIN_RETENTION_MS || retention > MAX_RETENTION_MS) {
    throw new Error('INVALID_DEADMAN_RETENTION');
  }
  return Math.floor(now - retention);
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
    headers: serviceHeaders(serviceRoleKey),
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
  if (!accepted) throw new Error('DEADMAN_REPLAY_RATE_LIMIT_OR_STORE_REJECTED');
  return true;
}

export async function readDeadManRecord(devicePseudonym, {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  configured({ supabaseUrl, serviceRoleKey });
  const pseudonym = normalizePseudonym(devicePseudonym);

  const url = new URL('/rest/v1/anti_scam_guardian_leases', supabaseUrl);
  url.searchParams.set('device_pseudonym', `eq.${pseudonym}`);
  url.searchParams.set('select', 'device_pseudonym,lease_epoch,heartbeat_sequence,lease_expires_at_ms,integrity_state,emergency_level,alert_delivery_state,policy_version,observed_at_ms,received_at_ms');
  url.searchParams.set('limit', '1');
  const response = await fetchImpl(url, {
    headers: serviceHeaders(serviceRoleKey),
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

export async function deleteDeadManRecord(devicePseudonym, {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  configured({ supabaseUrl, serviceRoleKey });
  const pseudonym = normalizePseudonym(devicePseudonym);
  const response = await fetchImpl(new URL('/rest/v1/rpc/delete_anti_scam_guardian_lease', supabaseUrl), {
    method: 'POST',
    headers: serviceHeaders(serviceRoleKey),
    body: JSON.stringify({ p_device_pseudonym: pseudonym }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`DEADMAN_DELETE_HTTP_${response.status}`);
  const body = await response.json();
  return body === true || (Array.isArray(body) && body[0] === true);
}

export async function purgeDeadManRecords({
  nowMs = Date.now(),
  retentionMs = DEADMAN_RETENTION_MS,
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  configured({ supabaseUrl, serviceRoleKey });
  const cutoff = retentionCutoffMs(nowMs, retentionMs);
  const response = await fetchImpl(new URL('/rest/v1/rpc/purge_anti_scam_guardian_leases', supabaseUrl), {
    method: 'POST',
    headers: serviceHeaders(serviceRoleKey),
    body: JSON.stringify({ p_cutoff_received_at_ms: cutoff }),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`DEADMAN_PURGE_HTTP_${response.status}`);
  const body = await response.json();
  const removed = Number(Array.isArray(body) ? body[0] : body);
  if (!Number.isInteger(removed) || removed < 0) throw new Error('DEADMAN_PURGE_REJECTED');
  return Object.freeze({ removed, cutoffReceivedAtMs: cutoff, retentionMs });
}
