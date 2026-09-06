import { evaluateVerifiedWitness } from './p0_5-verified-witness.mjs';

const ALLOWED_PROVIDER_FIELDS = new Set([
  'schema_version', 'state', 'claimable_active', 'same_boot_session', 'user_opted_in',
  'lease_epoch', 'lease_expires_at_ms', 'heartbeat_sequence', 'local_risk_level', 'active_engine_set', 'policy_version',
  'emergency_level', 'emergency_expires_at_ms', 'system_web_shield_state', 'integrity_state',
  'unexpected_protection_loss', 'freeze_sensitive_laneriq_actions', 'self_integrity_state',
  'self_integrity_continuity_acceptable', 'install_source_integrity_state', 'install_source_continuity_acceptable',
  'alert_delivery_state', 'alert_delivery_available', 'platform_integrity_state', 'background_restricted',
  'battery_optimization_exemption', 'witness_proof_schema', 'witness_proof_available',
  'witness_key_id_sha256', 'witness_public_key_b64', 'witness_signature_b64', 'witness_observed_at_ms',
  'last_stop_reason',
]);

function rejectUnexpectedFields(row = {}) {
  const unknown = Object.keys(row).filter(key => !ALLOWED_PROVIDER_FIELDS.has(key));
  if (unknown.length) throw new Error(`ANTI_SCAM_PROVIDER_PRIVATE_OR_UNKNOWN_FIELDS:${unknown.join(',')}`);
}

export function normalizeAntiScamProviderRow(row = {}) {
  rejectUnexpectedFields(row);
  const schemaVersion = Number(row.schema_version || 0);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 10) {
    throw new Error('ANTI_SCAM_PROVIDER_SCHEMA_TOO_OLD');
  }

  return Object.freeze({
    schemaVersion,
    guardianState: String(row.state || 'UNKNOWN'),
    integrityState: String(row.integrity_state || 'UNKNOWN'),
    emergencyLevel: String(row.emergency_level || 'NONE'),
    alertDeliveryState: String(row.alert_delivery_state || 'UNKNOWN'),
    leaseEpoch: Number(row.lease_epoch || 0),
    heartbeatSequence: Number(row.heartbeat_sequence || 0),
    leaseExpiresAtMs: Number(row.lease_expires_at_ms || 0),
    policyVersion: String(row.policy_version || 'unknown'),
    observedAtMs: Number(row.witness_observed_at_ms || 0),
    providerFreezeSensitive: String(row.freeze_sensitive_laneriq_actions || '0') === '1',
    cryptoProof: Object.freeze({
      packageName: 'ai.laneriq.antiscam',
      schemaVersion: Number(row.witness_proof_schema || 0),
      observedAtMs: Number(row.witness_observed_at_ms || 0),
      keyIdSha256: String(row.witness_key_id_sha256 || ''),
      publicKeyBase64: String(row.witness_public_key_b64 || ''),
      signatureBase64: String(row.witness_signature_b64 || ''),
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
  if (!normalized.cryptoProof.available || normalized.cryptoProof.schemaVersion !== 1) {
    return Object.freeze({
      verificationState: 'CRYPTO_PROOF_INVALID',
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: true,
      hackerAttributionAllowed: false,
      reason: 'anti_scam_witness_proof_unavailable_or_schema_invalid',
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

  const verified = evaluateVerifiedWitness({
    providerReachable: true,
    snapshot,
    lastKnownSnapshot,
    cryptoProof: normalized.cryptoProof,
    packageSignatureTrustVerified,
    keyContinuity,
    replayGuard,
    nowMs,
  });

  if (normalized.providerFreezeSensitive && verified.freezeSensitiveLaneriqActions !== true) {
    return Object.freeze({
      ...verified,
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: true,
      reason: 'provider_requires_sensitive_action_freeze',
    });
  }
  return verified;
}
