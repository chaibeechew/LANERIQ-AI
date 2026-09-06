import { evaluateGuardianWitness, evaluateGuardianWitnessObservation } from './p0_5-guardian-witness.mjs';
import { verifyWitnessCryptoProof, WitnessKeyState } from './p0_5-witness-crypto-proof.mjs';

export const VerifiedWitnessState = Object.freeze({
  VERIFIED: 'VERIFIED',
  PACKAGE_TRUST_REQUIRED: 'PACKAGE_TRUST_REQUIRED',
  CRYPTO_PROOF_INVALID: 'CRYPTO_PROOF_INVALID',
  KEY_ENROLLMENT_REQUIRED: 'KEY_ENROLLMENT_REQUIRED',
  KEY_CHANGED_REENROLL_REQUIRED: 'KEY_CHANGED_REENROLL_REQUIRED',
  REPLAY_REJECTED: 'REPLAY_REJECTED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
});

function fail(state, reason, { notify = true } = {}) {
  return Object.freeze({
    verificationState: state,
    protectedClaimAllowed: false,
    freezeSensitiveLaneriqActions: true,
    shouldNotifyUser: notify,
    hackerAttributionAllowed: false,
    reason,
  });
}

/**
 * Consumer-side P0.5 pipeline for AI App Builder/future same-developer apps.
 * No single weak fact is enough to show Protected.
 */
export function evaluateVerifiedWitness({
  providerReachable = true,
  snapshot = null,
  lastKnownSnapshot = null,
  cryptoProof = null,
  packageSignatureTrustVerified = false,
  keyContinuity = null,
  replayGuard = null,
  witnessSlot = 'laneriq-anti-scam-local',
  nowMs = Date.now(),
} = {}) {
  if (!providerReachable || !snapshot) {
    const deadMan = evaluateGuardianWitnessObservation({
      providerReachable: false,
      liveSnapshot: null,
      lastKnownSnapshot,
      nowMs,
    });
    return Object.freeze({
      verificationState: VerifiedWitnessState.PROVIDER_UNAVAILABLE,
      ...deadMan,
    });
  }

  if (!packageSignatureTrustVerified) {
    return fail(VerifiedWitnessState.PACKAGE_TRUST_REQUIRED, 'same_developer_package_signature_trust_not_verified');
  }
  if (!keyContinuity || typeof keyContinuity.status !== 'function') {
    return fail(VerifiedWitnessState.KEY_ENROLLMENT_REQUIRED, 'witness_key_continuity_store_required');
  }
  if (!replayGuard || typeof replayGuard.evaluate !== 'function') {
    return fail(VerifiedWitnessState.REPLAY_REJECTED, 'witness_replay_guard_required');
  }
  if (!cryptoProof || typeof cryptoProof !== 'object') {
    return fail(VerifiedWitnessState.CRYPTO_PROOF_INVALID, 'missing_witness_crypto_proof');
  }

  const proofPayload = {
    packageName: cryptoProof.packageName,
    leaseEpoch: snapshot.leaseEpoch,
    heartbeatSequence: snapshot.heartbeatSequence,
    leaseExpiresAtMs: snapshot.leaseExpiresAtMs,
    integrityState: snapshot.integrityState,
    emergencyLevel: snapshot.emergencyLevel,
    alertDeliveryState: snapshot.alertDeliveryState,
    policyVersion: snapshot.policyVersion,
    observedAtMs: cryptoProof.observedAtMs,
    schemaVersion: cryptoProof.schemaVersion,
  };
  const crypto = verifyWitnessCryptoProof({
    payload: proofPayload,
    publicKeyBase64: cryptoProof.publicKeyBase64,
    signatureBase64: cryptoProof.signatureBase64,
    keyIdSha256: cryptoProof.keyIdSha256,
  });
  if (!crypto.verified) {
    return fail(VerifiedWitnessState.CRYPTO_PROOF_INVALID, crypto.reason);
  }

  const keyStatus = keyContinuity.status(witnessSlot, crypto.keyIdSha256);
  if (keyStatus.state === WitnessKeyState.UNENROLLED) {
    return fail(VerifiedWitnessState.KEY_ENROLLMENT_REQUIRED, 'witness_key_not_enrolled');
  }
  if (keyStatus.state === WitnessKeyState.KEY_CHANGED_REENROLL_REQUIRED) {
    return fail(VerifiedWitnessState.KEY_CHANGED_REENROLL_REQUIRED, 'witness_key_changed');
  }
  if (!keyStatus.trusted) {
    return fail(VerifiedWitnessState.KEY_ENROLLMENT_REQUIRED, 'witness_key_not_trusted');
  }

  const replay = replayGuard.evaluate({
    devicePseudonym: witnessSlot,
    leaseEpoch: Number(snapshot.leaseEpoch || 0),
    heartbeatSequence: Number(snapshot.heartbeatSequence || 0),
    observedAtMs: Number(cryptoProof.observedAtMs || 0),
  }, { nowMs });
  if (!replay.accepted) {
    return fail(VerifiedWitnessState.REPLAY_REJECTED, replay.reason);
  }

  const witness = evaluateGuardianWitness(snapshot, { nowMs });
  return Object.freeze({
    verificationState: VerifiedWitnessState.VERIFIED,
    cryptoVerified: true,
    keyContinuityVerified: true,
    replayFreshnessVerified: true,
    ...witness,
  });
}
