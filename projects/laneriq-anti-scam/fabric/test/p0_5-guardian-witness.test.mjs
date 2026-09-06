import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WitnessState,
  evaluateGuardianWitness,
  buildPrivacySafeGuardianHeartbeat,
} from '../p0_5-guardian-witness.mjs';

test('P0.5 witness accepts only a fresh active same-boot lease as protected', () => {
  const now = 1_000_000;
  const result = evaluateGuardianWitness({
    userOptedIn: true,
    claimableActive: true,
    sameBootSession: true,
    heartbeatSequence: 12,
    leaseExpiresAtMs: now + 60_000,
    integrityState: 'ACTIVE',
    emergencyLevel: 'NONE',
  }, { nowMs: now });
  assert.equal(result.state, WitnessState.VERIFIED_ACTIVE);
  assert.equal(result.protectedClaimAllowed, true);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 expired heartbeat becomes protection lost but never hacker attribution', () => {
  const now = 2_000_000;
  const result = evaluateGuardianWitness({
    userOptedIn: true,
    claimableActive: false,
    sameBootSession: true,
    heartbeatSequence: 44,
    leaseExpiresAtMs: now - 1,
    integrityState: 'PROTECTION_LOST_UNEXPECTEDLY',
    unexpectedProtectionLoss: true,
  }, { nowMs: now });
  assert.equal(result.state, WitnessState.PROTECTION_LOST);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.freezeSensitiveLaneriqActions, true);
  assert.equal(result.shouldNotifyUser, true);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 user pause is distinguishable from unexpected protection loss', () => {
  const result = evaluateGuardianWitness({
    userOptedIn: false,
    claimableActive: false,
    integrityState: 'USER_PAUSED',
  }, { nowMs: 10_000 });
  assert.equal(result.state, WitnessState.USER_PAUSED);
  assert.equal(result.shouldNotifyUser, false);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 reboot/session uncertainty never inherits old protected status', () => {
  const result = evaluateGuardianWitness({
    userOptedIn: true,
    claimableActive: false,
    sameBootSession: false,
    heartbeatSequence: 0,
    leaseExpiresAtMs: 0,
    integrityState: 'VERIFYING',
  }, { nowMs: 10_000 });
  assert.equal(result.state, WitnessState.VERIFYING);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.freezeSensitiveLaneriqActions, true);
});

test('P0.5 privacy-safe heartbeat contains only minimal protection facts', () => {
  const heartbeat = buildPrivacySafeGuardianHeartbeat({
    devicePseudonym: 'pseudonym-1',
    leaseEpoch: 7,
    heartbeatSequence: 99,
    integrityState: 'ACTIVE',
    emergencyLevel: 'NONE',
    policyVersion: 'p0.5',
    observedAtMs: 12345,
  });
  assert.deepEqual(Object.keys(heartbeat).sort(), [
    'devicePseudonym',
    'emergencyLevel',
    'heartbeatSequence',
    'integrityState',
    'leaseEpoch',
    'observedAtMs',
    'policyVersion',
    'schemaVersion',
  ].sort());
  for (const forbidden of ['rawUrl', 'messageBody', 'fileName', 'eventLog', 'installationId', 'password', 'authToken']) {
    assert.equal(Object.hasOwn(heartbeat, forbidden), false);
  }
});
