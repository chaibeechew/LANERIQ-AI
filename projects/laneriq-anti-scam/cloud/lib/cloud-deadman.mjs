import crypto from 'node:crypto';

const CLOUD_STALE_MS = 5 * 60 * 1000;

export function installationPseudonym(keyIdSha256, pseudonymKey = process.env.LANERIQ_ANTI_SCAM_PSEUDONYM_KEY) {
  if (!/^[0-9a-f]{64}$/i.test(String(keyIdSha256 || ''))) throw new Error('INVALID_WITNESS_KEY_ID');
  if (!pseudonymKey || String(pseudonymKey).length < 32) throw new Error('PSEUDONYM_KEY_NOT_CONFIGURED');
  return crypto.createHmac('sha256', pseudonymKey)
    .update(`guardian-witness-v1:${String(keyIdSha256).toLowerCase()}`)
    .digest('hex');
}

export function buildCloudDeadManRecord(verifiedProof, {
  receivedAtMs = Date.now(),
  pseudonymKey = process.env.LANERIQ_ANTI_SCAM_PSEUDONYM_KEY,
} = {}) {
  if (!verifiedProof?.payload || !verifiedProof?.keyIdSha256) throw new Error('VERIFIED_WITNESS_PROOF_REQUIRED');
  const p = verifiedProof.payload;
  return Object.freeze({
    schema: 1,
    devicePseudonym: installationPseudonym(verifiedProof.keyIdSha256, pseudonymKey),
    leaseEpoch: p.leaseEpoch,
    heartbeatSequence: p.heartbeatSequence,
    leaseExpiresAtMs: p.leaseExpiresAtMs,
    integrityState: p.integrityState,
    emergencyLevel: p.emergencyLevel,
    alertDeliveryState: p.alertDeliveryState,
    policyVersion: p.policyVersion,
    observedAtMs: p.observedAtMs,
    receivedAtMs,
  });
}

export function evaluateCloudDeadMan(record, nowMs = Date.now()) {
  if (!record || record.schema !== 1) return Object.freeze({ state: 'UNKNOWN', notify: false, reason: 'missing-record' });
  if (!Number.isFinite(record.observedAtMs) || nowMs - record.observedAtMs > CLOUD_STALE_MS) {
    return Object.freeze({ state: 'VERIFICATION_UNAVAILABLE', notify: true, reason: 'cloud-heartbeat-stale' });
  }
  if (record.leaseExpiresAtMs <= nowMs) {
    return Object.freeze({ state: 'PROTECTION_LOST', notify: true, reason: 'lease-expired' });
  }
  if (String(record.integrityState).includes('UNEXPECTED') || String(record.integrityState).includes('LOST')) {
    return Object.freeze({ state: 'PROTECTION_LOST', notify: true, reason: 'guardian-integrity-loss' });
  }
  if (String(record.emergencyLevel).toUpperCase() === 'URGENT') {
    return Object.freeze({ state: 'URGENT', notify: true, reason: 'device-emergency' });
  }
  return Object.freeze({ state: 'FRESH', notify: false, reason: 'verified-heartbeat-fresh' });
}

export function assertPrivacyMinimalDeadManRecord(record = {}) {
  const allowed = new Set([
    'schema', 'devicePseudonym', 'leaseEpoch', 'heartbeatSequence', 'leaseExpiresAtMs',
    'integrityState', 'emergencyLevel', 'alertDeliveryState', 'policyVersion',
    'observedAtMs', 'receivedAtMs',
  ]);
  const forbidden = Object.keys(record).filter(key => !allowed.has(key));
  if (forbidden.length) throw new Error(`FORBIDDEN_DEADMAN_FIELDS:${forbidden.join(',')}`);
  return true;
}
