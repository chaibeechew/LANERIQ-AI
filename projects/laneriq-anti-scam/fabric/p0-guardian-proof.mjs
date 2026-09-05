import { ProtectionState, requireNonEmpty } from './contracts.mjs';

export function verifyGuardianProof(proof = {}, { nowMs = Date.now(), maxLeaseTtlMs = 120_000 } = {}) {
  try {
    requireNonEmpty(proof.installationId, 'installationId');
    requireNonEmpty(proof.sessionId, 'sessionId');
    requireNonEmpty(proof.publisherDigest, 'publisherDigest');
  } catch (error) {
    return { valid: false, state: ProtectionState.UNKNOWN, reason: error.message };
  }

  const leaseEpoch = Number(proof.leaseEpoch);
  const heartbeatSequence = Number(proof.heartbeatSequence);
  const heartbeatAtMs = Number(proof.heartbeatAtMs);
  const leaseExpiresAtMs = Number(proof.leaseExpiresAtMs);
  const bootSessionId = String(proof.bootSessionId || '');
  const expectedBootSessionId = String(proof.expectedBootSessionId || '');

  if (!Number.isInteger(leaseEpoch) || leaseEpoch <= 0) return { valid: false, state: ProtectionState.UNKNOWN, reason: 'invalid_lease_epoch' };
  if (!Number.isInteger(heartbeatSequence) || heartbeatSequence <= 0) return { valid: false, state: ProtectionState.UNKNOWN, reason: 'invalid_heartbeat_sequence' };
  if (!Number.isFinite(heartbeatAtMs) || heartbeatAtMs <= 0 || heartbeatAtMs > nowMs + 5_000) return { valid: false, state: ProtectionState.UNKNOWN, reason: 'clock_anomaly' };
  if (!Number.isFinite(leaseExpiresAtMs) || leaseExpiresAtMs <= heartbeatAtMs) return { valid: false, state: ProtectionState.DEGRADED, reason: 'invalid_expiry' };
  if (leaseExpiresAtMs - heartbeatAtMs > maxLeaseTtlMs) return { valid: false, state: ProtectionState.DEGRADED, reason: 'lease_ttl_too_long' };
  if (nowMs > leaseExpiresAtMs) return { valid: false, state: ProtectionState.DEGRADED, reason: 'lease_expired' };
  if (!bootSessionId || !expectedBootSessionId || bootSessionId !== expectedBootSessionId) return { valid: false, state: ProtectionState.DEGRADED, reason: 'boot_session_mismatch' };
  if (proof.userOptedIn !== true) return { valid: false, state: ProtectionState.PAUSED, reason: 'user_not_opted_in' };
  if (proof.serviceEnabled !== true) return { valid: false, state: ProtectionState.DEGRADED, reason: 'guardian_service_offline' };

  return {
    valid: true,
    state: ProtectionState.ACTIVE,
    reason: 'fresh_guardian_proof',
    installationId: proof.installationId,
    sessionId: proof.sessionId,
    leaseEpoch,
    heartbeatSequence,
    leaseExpiresAtMs,
  };
}
