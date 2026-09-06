import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WitnessState,
  evaluateGuardianWitness,
  evaluateGuardianWitnessObservation,
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
    alertDeliveryAvailable: true,
  }, { nowMs: now });
  assert.equal(result.state, WitnessState.VERIFIED_ACTIVE);
  assert.equal(result.protectedClaimAllowed, true);
  assert.equal(result.shouldNotifyUser, false);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 active Guardian with disabled Anti Scam notifications asks companion witness to warn', () => {
  const now = 1_000_000;
  const result = evaluateGuardianWitness({
    userOptedIn: true,
    claimableActive: true,
    sameBootSession: true,
    heartbeatSequence: 12,
    leaseExpiresAtMs: now + 60_000,
    integrityState: 'ACTIVE',
    emergencyLevel: 'NONE',
    alertDeliveryAvailable: false,
  }, { nowMs: now });
  assert.equal(result.state, WitnessState.VERIFIED_ACTIVE);
  assert.equal(result.protectedClaimAllowed, true);
  assert.equal(result.shouldNotifyUser, true);
  assert.equal(result.freezeSensitiveLaneriqActions, false);
  assert.equal(result.reason, 'guardian_active_but_alert_delivery_degraded');
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

test('P0.5 missing provider is never misread as user pause', () => {
  const result = evaluateGuardianWitness(null, { nowMs: 10_000 });
  assert.equal(result.state, WitnessState.VERIFICATION_UNAVAILABLE);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.freezeSensitiveLaneriqActions, true);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 dead-man witness marks protection lost after last known active lease expires while provider is unreachable', () => {
  const now = 50_000;
  const result = evaluateGuardianWitnessObservation({
    providerReachable: false,
    liveSnapshot: null,
    lastKnownSnapshot: {
      userOptedIn: true,
      claimableActive: true,
      sameBootSession: true,
      heartbeatSequence: 77,
      leaseExpiresAtMs: now - 1,
      integrityState: 'ACTIVE',
    },
    nowMs: now,
  });
  assert.equal(result.state, WitnessState.PROTECTION_LOST);
  assert.equal(result.shouldNotifyUser, true);
  assert.equal(result.freezeSensitiveLaneriqActions, true);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('P0.5 provider outage before prior lease expiry requires reverification but does not claim active', () => {
  const now = 50_000;
  const result = evaluateGuardianWitnessObservation({
    providerReachable: false,
    lastKnownSnapshot: {
      userOptedIn: true,
      claimableActive: true,
      leaseExpiresAtMs: now + 30_000,
    },
    nowMs: now,
  });
  assert.equal(result.state, WitnessState.VERIFICATION_UNAVAILABLE);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.shouldNotifyUser, false);
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
    alertDeliveryState: 'AVAILABLE',
    policyVersion: 'p0.5',
    observedAtMs: 12345,
  });
  assert.deepEqual(Object.keys(heartbeat).sort(), [
    'alertDeliveryState',
    'devicePseudonym',
    'emergencyLevel',
    'heartbeatSequence',
    'integrityState',
    'leaseEpoch',
    'observedAtMs',
    'policyVersion',
    'schemaVersion',
  ].sort());
  assert.equal(heartbeat.schemaVersion, 2);
  for (const forbidden of ['rawUrl', 'messageBody', 'fileName', 'eventLog', 'installationId', 'password', 'authToken']) {
    assert.equal(Object.hasOwn(heartbeat, forbidden), false);
  }
});
