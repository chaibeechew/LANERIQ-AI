export const WitnessState = Object.freeze({
  VERIFIED_ACTIVE: 'VERIFIED_ACTIVE',
  USER_PAUSED: 'USER_PAUSED',
  PROTECTION_LOST: 'PROTECTION_LOST',
  VERIFYING: 'VERIFYING',
  VERIFICATION_UNAVAILABLE: 'VERIFICATION_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
});

function unknownWitness(reason, shouldNotifyUser = false) {
  return Object.freeze({
    state: WitnessState.VERIFICATION_UNAVAILABLE,
    protectedClaimAllowed: false,
    freezeSensitiveLaneriqActions: true,
    shouldNotifyUser,
    hackerAttributionAllowed: false,
    reason,
  });
}

/**
 * Independent witness policy for another LANERIQ app or a privacy-safe cloud
 * control plane. It observes protection evidence; it does not run a second
 * Guardian and it never attributes a missing heartbeat to a hacker by itself.
 */
export function evaluateGuardianWitness(snapshot, { nowMs = Date.now() } = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return unknownWitness('guardian_status_provider_unavailable');
  }

  const hasOptInFact = snapshot.userOptedIn === true || snapshot.userOptedIn === false;
  if (!hasOptInFact) {
    return unknownWitness('guardian_opt_in_state_unavailable');
  }

  const userOptedIn = snapshot.userOptedIn === true;
  const claimableActive = snapshot.claimableActive === true;
  const sameBootSession = snapshot.sameBootSession === true;
  const heartbeatSequence = Number(snapshot.heartbeatSequence || 0);
  const leaseExpiresAtMs = Number(snapshot.leaseExpiresAtMs || 0);
  const integrityState = String(snapshot.integrityState || 'UNKNOWN');
  const unexpectedProtectionLoss = snapshot.unexpectedProtectionLoss === true;
  const emergencyLevel = String(snapshot.emergencyLevel || 'NONE');

  if (!userOptedIn) {
    return Object.freeze({
      state: WitnessState.USER_PAUSED,
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: emergencyLevel === 'URGENT',
      shouldNotifyUser: emergencyLevel === 'URGENT',
      hackerAttributionAllowed: false,
      reason: 'user_paused_guardian',
    });
  }

  const leaseFresh = Number.isFinite(leaseExpiresAtMs)
    && leaseExpiresAtMs > nowMs
    && heartbeatSequence > 0
    && sameBootSession;

  if (claimableActive && leaseFresh && integrityState === 'ACTIVE') {
    return Object.freeze({
      state: WitnessState.VERIFIED_ACTIVE,
      protectedClaimAllowed: true,
      freezeSensitiveLaneriqActions: emergencyLevel === 'URGENT',
      shouldNotifyUser: emergencyLevel === 'URGENT',
      hackerAttributionAllowed: false,
      reason: emergencyLevel === 'URGENT'
        ? 'guardian_active_but_emergency_risk_present'
        : 'fresh_guardian_lease_verified',
    });
  }

  if (unexpectedProtectionLoss
      || ['PROTECTION_LOST_UNEXPECTEDLY', 'RESTORE_THROTTLED'].includes(integrityState)
      || (leaseExpiresAtMs > 0 && leaseExpiresAtMs <= nowMs)) {
    return Object.freeze({
      state: WitnessState.PROTECTION_LOST,
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: true,
      hackerAttributionAllowed: false,
      reason: unexpectedProtectionLoss
        ? 'unexpected_guardian_protection_loss'
        : 'guardian_lease_no_longer_verifiable',
    });
  }

  if (integrityState === 'VERIFYING' || !sameBootSession || heartbeatSequence === 0) {
    return Object.freeze({
      state: WitnessState.VERIFYING,
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: false,
      hackerAttributionAllowed: false,
      reason: 'waiting_for_fresh_guardian_proof',
    });
  }

  return Object.freeze({
    state: WitnessState.UNKNOWN,
    protectedClaimAllowed: false,
    freezeSensitiveLaneriqActions: true,
    shouldNotifyUser: false,
    hackerAttributionAllowed: false,
    reason: 'guardian_status_cannot_be_proven',
  });
}

/**
 * Evaluate a live-provider observation with a last-known snapshot. This is the
 * dead-man path used when Anti Scam itself cannot answer (for example a stopped
 * package, crash, OS restriction, or other unavailability).
 */
export function evaluateGuardianWitnessObservation({
  providerReachable = true,
  liveSnapshot = null,
  lastKnownSnapshot = null,
  nowMs = Date.now(),
} = {}) {
  if (providerReachable && liveSnapshot) {
    return evaluateGuardianWitness(liveSnapshot, { nowMs });
  }

  if (!lastKnownSnapshot || typeof lastKnownSnapshot !== 'object') {
    return unknownWitness('guardian_provider_unavailable_without_prior_proof');
  }

  const priorOptedIn = lastKnownSnapshot.userOptedIn === true;
  const priorExpiry = Number(lastKnownSnapshot.leaseExpiresAtMs || 0);
  const priorClaimable = lastKnownSnapshot.claimableActive === true;

  if (priorOptedIn && priorClaimable && priorExpiry > 0 && priorExpiry <= nowMs) {
    return Object.freeze({
      state: WitnessState.PROTECTION_LOST,
      protectedClaimAllowed: false,
      freezeSensitiveLaneriqActions: true,
      shouldNotifyUser: true,
      hackerAttributionAllowed: false,
      reason: 'guardian_provider_unavailable_after_last_known_lease_expired',
    });
  }

  return unknownWitness('guardian_provider_unavailable_reverification_required');
}

/**
 * Minimal cloud/witness heartbeat. Deliberately contains no raw URL, file name,
 * app history, local event log, message content, contact, token, or stable raw
 * installation identifier.
 */
export function buildPrivacySafeGuardianHeartbeat({
  devicePseudonym,
  leaseEpoch,
  heartbeatSequence,
  integrityState,
  emergencyLevel = 'NONE',
  policyVersion = 'unknown',
  observedAtMs = Date.now(),
} = {}) {
  if (typeof devicePseudonym !== 'string' || devicePseudonym.trim() === '') {
    throw new Error('devicePseudonym required');
  }
  if (!Number.isFinite(Number(observedAtMs)) || Number(observedAtMs) <= 0) {
    throw new Error('valid observedAtMs required');
  }
  return Object.freeze({
    schemaVersion: 1,
    devicePseudonym: devicePseudonym.trim(),
    leaseEpoch: Math.max(0, Number(leaseEpoch || 0)),
    heartbeatSequence: Math.max(0, Number(heartbeatSequence || 0)),
    integrityState: String(integrityState || 'UNKNOWN'),
    emergencyLevel: String(emergencyLevel || 'NONE'),
    policyVersion: String(policyVersion || 'unknown'),
    observedAtMs: Number(observedAtMs),
  });
}
