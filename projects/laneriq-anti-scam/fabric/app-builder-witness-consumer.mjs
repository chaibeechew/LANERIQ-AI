import { evaluateVerifiedWitness } from './p0_5-verified-witness.mjs';

const ALLOWED_PROVIDER_FIELDS = new Set([
  'guardian_state', 'guardian_integrity', 'emergency_level', 'alert_delivery_state',
  'lease_epoch', 'heartbeat_sequence', 'lease_expires_at_ms', 'policy_version',
  'observed_at_ms', 'witness_key_id_sha256', 'witness_public_key_base64',
  'witness_signature_base64', 'witness_proof_available',
]);

function rejectUnexpectedFields(row = {}) {
  const unknown = Object.keys(row).filter(key => !ALLOWED_PROVIDER_FIELDS.has(key));
  if (unknown.length) throw new Error(`ANTI_SCAM_PROVIDER_PRIVATE_OR_UNKNOWN_FIELDS:${unknown.join(',')}`);
}

export function normalizeAntiScamProviderRow(row = {}) {
  rejectUnexpectedFields(row);
  return Object.freeze({
    guardianState: String(row.guardian_state || 'UNKNOWN'),
    integrityState: String(row.guardian_integrity || 'UNKNOWN'),
    emergencyLevel: String(row.emergency_level || 'NONE'),
    alertDeliveryState: String(row.alert_delivery_state || 'UNKNOWN'),
    leaseEpoch: Number(row.lease_epoch || 0),
    heartbeatSequence: Number(row.heartbeat_sequence || 0),
    leaseExpiresAtMs: Number(row.lease_expires_at_ms || 0),
    policyVersion: String(row.policy_version || 'unknown'),
    observedAtMs: Number(row.observed_at_ms || 0),
    cryptoProof: Object.freeze({
      packageName: 'ai.laneriq.antiscam',
      schemaVersion: 1,
      observedAtMs: Number(row.observed_at_ms || 0),
      keyIdSha256: String(row.witness_key_id_sha256 || ''),
      publicKeyBase64: String(row.witness_public_key_base64 || ''),
      signatureBase64: String(row.witness_signature_base64 || ''),
      available: String(row.witness_proof_available || '0') === '1',
    }),
  });
}

/**
 * AI App Builder/future LANERIQ app integration surface.
 * It consumes Anti Scam security truth only. It never starts a second Guardian,
 * VPN, scanner daemon or private-content monitor.
 */
export function evaluateAppBuilderProtection({
  providerReachable,
  providerRow,
  lastKnownSnapshot,
  packageSignatureTrustVerified,
  keyContinuity,
  replayGuard,
  nowMs = Date.now(),
} = {}) {
  if (!providerReachable || !providerRow) {
    return evaluateVerifiedWitness({
      providerReachable: false,
      snapshot: null,
      lastKnownSnapshot,
      packageSignatureTrustVerified,
      keyContinuity,
      replayGuard,
      nowMs,
    });
  }

  const normalized = normalizeAntiScamProviderRow(providerRow);
  if (!normalized.cryptoProof.available) {
    return Object.freeze({
      verificationState: 'CRYPTO_PROOF_INVALID',
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: true,
      hackerAttributionAllowed: false,
      reason: 'anti_scam_witness_proof_unavailable',
    });
  }

  const snapshot = {
    guardianState: normalized.guardianState,
    integrityState: normalized.integrityState,
    emergencyLevel: normalized.emergencyLevel,
    alertDeliveryState: normalized.alertDeliveryState,
    leaseEpoch: normalized.leaseEpoch,
    heartbeatSequence: normalized.heartbeatSequence,
    leaseExpiresAtMs: normalized.leaseExpiresAtMs,
    policyVersion: normalized.policyVersion,
  };

  return evaluateVerifiedWitness({
    providerReachable: true,
    snapshot,
    lastKnownSnapshot,
    cryptoProof: normalized.cryptoProof,
    packageSignatureTrustVerified,
    keyContinuity,
    replayGuard,
    nowMs,
  });
}
