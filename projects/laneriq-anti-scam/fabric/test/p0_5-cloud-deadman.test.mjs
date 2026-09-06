import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrivacySafeGuardianHeartbeat,
  validatePrivacySafeGuardianHeartbeat,
  evaluateCloudDeadManHeartbeat,
  CloudDeadManState,
} from '../p0_5-guardian-witness.mjs';

const NOW = 2_000_000;

function hb(overrides = {}) {
  return buildPrivacySafeGuardianHeartbeat({
    devicePseudonym: 'pseudo-device-a',
    leaseEpoch: 4,
    heartbeatSequence: 20,
    integrityState: 'ACTIVE',
    emergencyLevel: 'NONE',
    alertDeliveryState: 'AVAILABLE',
    platformIntegrityState: 'HEALTHY',
    policyVersion: 'p0.5-v1',
    observedAtMs: NOW - 5_000,
    ...overrides,
  });
}

test('cloud heartbeat schema contains only minimal protection state', () => {
  const heartbeat = hb();
  assert.equal(validatePrivacySafeGuardianHeartbeat(heartbeat).valid, true);
  assert.equal(Object.hasOwn(heartbeat, 'rawUrl'), false);
  assert.equal(Object.hasOwn(heartbeat, 'messageBody'), false);
  assert.equal(Object.hasOwn(heartbeat, 'fileName'), false);
  assert.equal(Object.hasOwn(heartbeat, 'eventLog'), false);
});

test('cloud heartbeat rejects accidental private or unknown fields', () => {
  const bad = { ...hb(), rawUrl: 'https://private.example/account' };
  const result = validatePrivacySafeGuardianHeartbeat(bad);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'non_minimal_fields_present');
});

test('fresh heartbeat means cloud verification is healthy but cannot itself claim local protection', () => {
  const result = evaluateCloudDeadManHeartbeat({ current: hb(), nowMs: NOW });
  assert.equal(result.state, CloudDeadManState.FRESH);
  assert.equal(result.verificationHealthy, true);
  assert.equal(result.protectedClaimAllowed, false);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('stale heartbeat becomes verification lost without hacker attribution', () => {
  const result = evaluateCloudDeadManHeartbeat({
    current: hb({ observedAtMs: NOW - 500_000 }),
    nowMs: NOW,
    maxAgeMs: 180_000,
  });
  assert.equal(result.state, CloudDeadManState.STALE);
  assert.equal(result.verificationHealthy, false);
  assert.equal(result.hackerAttributionAllowed, false);
});

test('same-epoch heartbeat sequence regression fails closed', () => {
  const previous = hb({ heartbeatSequence: 25, observedAtMs: NOW - 20_000 });
  const current = hb({ heartbeatSequence: 24, observedAtMs: NOW - 5_000 });
  const result = evaluateCloudDeadManHeartbeat({ current, previous, nowMs: NOW });
  assert.equal(result.state, CloudDeadManState.SEQUENCE_REGRESSION);
  assert.equal(result.verificationHealthy, false);
});

test('newer epoch may reset sequence', () => {
  const previous = hb({ leaseEpoch: 4, heartbeatSequence: 99, observedAtMs: NOW - 20_000 });
  const current = hb({ leaseEpoch: 5, heartbeatSequence: 1, observedAtMs: NOW - 5_000 });
  const result = evaluateCloudDeadManHeartbeat({ current, previous, nowMs: NOW });
  assert.equal(result.state, CloudDeadManState.FRESH);
});

test('device pseudonym change is not silently accepted as continuity', () => {
  const previous = hb();
  const current = hb({ devicePseudonym: 'pseudo-device-b', heartbeatSequence: 21 });
  const result = evaluateCloudDeadManHeartbeat({ current, previous, nowMs: NOW });
  assert.equal(result.state, CloudDeadManState.IDENTITY_CHANGED);
});
