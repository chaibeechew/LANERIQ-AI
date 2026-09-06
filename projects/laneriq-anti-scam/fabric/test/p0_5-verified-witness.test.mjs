import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

import { canonicalWitnessProofPayload, WitnessKeyContinuity } from '../p0_5-witness-crypto-proof.mjs';
import { GuardianWitnessReplayGuard } from '../p0_5-witness-replay-guard.mjs';
import { evaluateVerifiedWitness, VerifiedWitnessState } from '../p0_5-verified-witness.mjs';

const now = 1_000_000;

function snapshot(overrides = {}) {
  return {
    userOptedIn: true,
    claimableActive: true,
    sameBootSession: true,
    leaseEpoch: 5,
    heartbeatSequence: 10,
    leaseExpiresAtMs: now + 60_000,
    integrityState: 'ACTIVE',
    emergencyLevel: 'NONE',
    alertDeliveryState: 'AVAILABLE',
    alertDeliveryAvailable: true,
    policyVersion: 'p0.5-survival-1',
    unexpectedProtectionLoss: false,
    ...overrides,
  };
}

function signedProof(snap, overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const keyIdSha256 = createHash('sha256').update(publicDer).digest('hex');
  const proof = {
    packageName: 'ai.laneriq.antiscam.test',
    observedAtMs: now,
    schemaVersion: 1,
    publicKeyBase64: publicDer.toString('base64'),
    keyIdSha256,
    ...overrides,
  };
  const canonical = canonicalWitnessProofPayload({
    packageName: proof.packageName,
    leaseEpoch: snap.leaseEpoch,
    heartbeatSequence: snap.heartbeatSequence,
    leaseExpiresAtMs: snap.leaseExpiresAtMs,
    integrityState: snap.integrityState,
    emergencyLevel: snap.emergencyLevel,
    alertDeliveryState: snap.alertDeliveryState,
    policyVersion: snap.policyVersion,
    observedAtMs: proof.observedAtMs,
    schemaVersion: proof.schemaVersion,
  });
  proof.signatureBase64 = sign('sha256', Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
  return proof;
}

function enrolledContinuity(proof) {
  const continuity = new WitnessKeyContinuity();
  continuity.enroll(
    'laneriq-anti-scam-local',
    proof.keyIdSha256,
    { packageSignatureTrustVerified: true },
  );
  return continuity;
}

test('P0.5 full Witness pipeline allows Protected only after package trust, crypto, key pin, replay and lease gates', () => {
  const snap = snapshot();
  const proof = signedProof(snap);
  const result = evaluateVerifiedWitness({
    providerReachable: true,
    snapshot: snap,
    cryptoProof: proof,
    packageSignatureTrustVerified: true,
    keyContinuity: enrolledContinuity(proof),
    replayGuard: new GuardianWitnessReplayGuard(),
    nowMs: now,
  });
  assert.equal(result.verificationState, VerifiedWitnessState.VERIFIED);
  assert.equal(result.cryptoVerified, true);
  assert.equal(result.keyContinuityVerified, true);
  assert.equal(result.replayFreshnessVerified, true);
  assert.equal(result.protectedClaimAllowed, true);
});

test('P0.5 full Witness pipeline fails closed without same-developer package trust', () => {
  const snap = snapshot();
  const proof = signedProof(snap);
  const result = evaluateVerifiedWitness({
    snapshot: snap,
    cryptoProof: proof,
    packageSignatureTrustVerified: false,
    keyContinuity: enrolledContinuity(proof),
    replayGuard: new GuardianWitnessReplayGuard(),
    nowMs: now,
  });
  assert.equal(result.verificationState, VerifiedWitnessState.PACKAGE_TRUST_REQUIRED);
  assert.equal(result.protectedClaimAllowed, false);
});

test('P0.5 full Witness pipeline requires explicit key enrollment', () => {
  const snap = snapshot();
  const proof = signedProof(snap);
  const result = evaluateVerifiedWitness({
    snapshot: snap,
    cryptoProof: proof,
    packageSignatureTrustVerified: true,
    keyContinuity: new WitnessKeyContinuity(),
    replayGuard: new GuardianWitnessReplayGuard(),
    nowMs: now,
  });
  assert.equal(result.verificationState, VerifiedWitnessState.KEY_ENROLLMENT_REQUIRED);
  assert.equal(result.protectedClaimAllowed, false);
});

test('P0.5 full Witness pipeline rejects tampered heartbeat payload', () => {
  const signedSnap = snapshot();
  const proof = signedProof(signedSnap);
  const tampered = snapshot({ heartbeatSequence: 999 });
  const result = evaluateVerifiedWitness({
    snapshot: tampered,
    cryptoProof: proof,
    packageSignatureTrustVerified: true,
    keyContinuity: enrolledContinuity(proof),
    replayGuard: new GuardianWitnessReplayGuard(),
    nowMs: now,
  });
  assert.equal(result.verificationState, VerifiedWitnessState.CRYPTO_PROOF_INVALID);
  assert.equal(result.protectedClaimAllowed, false);
});

test('P0.5 full Witness pipeline rejects replay after a previously accepted heartbeat', () => {
  const snap = snapshot();
  const proof = signedProof(snap);
  const continuity = enrolledContinuity(proof);
  const replay = new GuardianWitnessReplayGuard();

  const first = evaluateVerifiedWitness({
    snapshot: snap,
    cryptoProof: proof,
    packageSignatureTrustVerified: true,
    keyContinuity: continuity,
    replayGuard: replay,
    nowMs: now,
  });
  assert.equal(first.protectedClaimAllowed, true);

  const second = evaluateVerifiedWitness({
    snapshot: snap,
    cryptoProof: proof,
    packageSignatureTrustVerified: true,
    keyContinuity: continuity,
    replayGuard: replay,
    nowMs: now + 1,
  });
  assert.equal(second.verificationState, VerifiedWitnessState.REPLAY_REJECTED);
  assert.equal(second.protectedClaimAllowed, false);
});

test('P0.5 unreachable Provider uses dead-man state and never silently remains Protected', () => {
  const result = evaluateVerifiedWitness({
    providerReachable: false,
    lastKnownSnapshot: snapshot({ leaseExpiresAtMs: now - 1 }),
    nowMs: now,
  });
  assert.equal(result.verificationState, VerifiedWitnessState.PROVIDER_UNAVAILABLE);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.freezeSensitiveLaneriqActions, true);
  assert.equal(result.hackerAttributionAllowed, false);
});
