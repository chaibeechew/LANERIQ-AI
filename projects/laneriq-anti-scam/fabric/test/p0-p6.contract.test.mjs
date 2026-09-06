import test from 'node:test';
import assert from 'node:assert/strict';

import { ProtectionState, RiskLevel } from '../contracts.mjs';
import { verifyGuardianProof } from '../p0-guardian-proof.mjs';
import { SecurityBroker } from '../p1-security-broker.mjs';
import { RegionalEdgeRouter } from '../p2-edge-router.mjs';
import { SecurityEventGraph } from '../p3-event-graph.mjs';
import { ActiveActiveRegionSet } from '../p4-active-active.mjs';
import { RolloutController } from '../p5-rollout-control.mjs';
import { CapacityEvidenceLedger } from '../p6-capacity-evidence.mjs';
import { signedPolicy } from './test-crypto.mjs';
import { recordPassingCapacityStage } from './test-capacity.mjs';

const TRUST = 'publisher-sha256:laneriq-test';

test('P0 accepts only a fresh same-boot opted-in Guardian proof', () => {
  const now = 1_000_000;
  const result = verifyGuardianProof({
    installationId: 'device-1', sessionId: 'session-1', publisherDigest: TRUST,
    leaseEpoch: 4, heartbeatSequence: 9, heartbeatAtMs: now - 10_000,
    leaseExpiresAtMs: now + 60_000, bootSessionId: 'boot-a', expectedBootSessionId: 'boot-a',
    userOptedIn: true, serviceEnabled: true,
  }, { nowMs: now });
  assert.equal(result.valid, true);
  assert.equal(result.state, ProtectionState.ACTIVE);
});

test('P0 rejects expired or pre-reboot Guardian evidence', () => {
  const expired = verifyGuardianProof({
    installationId: 'device-1', sessionId: 's', publisherDigest: TRUST,
    leaseEpoch: 1, heartbeatSequence: 1, heartbeatAtMs: 100,
    leaseExpiresAtMs: 200, bootSessionId: 'old', expectedBootSessionId: 'new',
    userOptedIn: true, serviceEnabled: true,
  }, { nowMs: 500 });
  assert.equal(expired.valid, false);
  assert.notEqual(expired.state, ProtectionState.ACTIVE);
});

test('P1 Broker refuses untrusted Guardian publisher through the proof path', () => {
  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => 1_000 });
  const status = broker.registerGuardianProof({ publisherDigest: 'other' });
  assert.equal(status.state, ProtectionState.UNKNOWN);
  assert.equal(status.reason, 'untrusted_guardian_publisher');
});

test('P1 Broker downgrades a previously verified Guardian after its lease expires', () => {
  let now = 1_000;
  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => now });
  const registered = broker.registerGuardianProof({
    installationId: 'd', sessionId: 's', publisherDigest: TRUST,
    leaseEpoch: 1, heartbeatSequence: 1, heartbeatAtMs: 900, leaseExpiresAtMs: 1_500,
    bootSessionId: 'boot-a', expectedBootSessionId: 'boot-a', userOptedIn: true, serviceEnabled: true,
  });
  assert.equal(registered.state, ProtectionState.ACTIVE);
  now = 1_501;
  assert.equal(broker.status().state, ProtectionState.DEGRADED);
});

test('P1 Broker deduplicates same client operation', () => {
  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => 5_000 });
  const request = { clientPackage: 'ai.laneriq.builder', publisherDigest: TRUST, operation: 'url_check', fingerprint: 'x' };
  assert.equal(broker.admitRequest(request).admitted, true);
  assert.equal(broker.admitRequest(request).reason, 'duplicate_request');
});

test('P2 routes to preferred healthy edge and falls back when unhealthy', () => {
  const router = new RegionalEdgeRouter({ regions: [{ id: 'sea-1', priority: 1 }, { id: 'jp-1', priority: 2 }] });
  assert.equal(router.route({ preferredRegion: 'sea-1' }).region, 'sea-1');
  router.markHealth('sea-1', false, false);
  const fallback = router.route({ preferredRegion: 'sea-1' });
  assert.equal(fallback.region, 'jp-1');
  assert.equal(fallback.fallback, true);
});

test('P2 deduplicates repeated device events', () => {
  const router = new RegionalEdgeRouter({ regions: [{ id: 'sea-1' }], now: () => 10_000 });
  const event = { installationId: 'd1', type: 'url', fingerprint: 'abc' };
  assert.equal(router.admitEvent(event).admitted, true);
  assert.equal(router.admitEvent(event).reason, 'duplicate_event');
});

test('P3 single weak signal never becomes malware proof', () => {
  const graph = new SecurityEventGraph();
  graph.add({ eventId: '1', installationId: 'd', type: 'developer_options', occurredAtMs: 1_000 });
  const incident = graph.incidentFor({ installationId: 'd', nowMs: 2_000 });
  assert.equal(incident.malwareVerdict, false);
  assert.equal(incident.risk, RiskLevel.LOW);
});

test('P3 correlates multiple independent signals into high review risk without claiming malware proof', () => {
  const graph = new SecurityEventGraph();
  const base = { installationId: 'd', occurredAtMs: 10_000 };
  graph.add({ ...base, eventId: '1', type: 'unknown_apk' });
  graph.add({ ...base, eventId: '2', type: 'accessibility_enabled', occurredAtMs: 11_000 });
  graph.add({ ...base, eventId: '3', type: 'remote_control_signal', occurredAtMs: 12_000 });
  graph.add({ ...base, eventId: '4', type: 'banking_context', occurredAtMs: 13_000 });
  const incident = graph.incidentFor({ installationId: 'd', nowMs: 14_000 });
  assert.equal(incident.strongCorroboration, true);
  assert.equal(incident.risk, RiskLevel.HIGH);
  assert.equal(incident.malwareVerdict, false);
});

test('P4 active/active chooses another writable region after evacuation', () => {
  const regions = new ActiveActiveRegionSet([
    { id: 'sea-a', group: 'sea', load: 0.1, latencyMs: 10 },
    { id: 'sea-b', group: 'sea', load: 0.2, latencyMs: 15 },
    { id: 'jp-a', group: 'jp', load: 0.1, latencyMs: 30 },
  ]);
  assert.equal(regions.select({ preferredGroup: 'sea', write: true }).region, 'sea-a');
  regions.evacuate('sea-a', true);
  assert.equal(regions.select({ preferredGroup: 'sea', write: true }).region, 'sea-b');
});

test('P4 resilience summary does not claim single-region-loss survival without two writable regions', () => {
  const regions = new ActiveActiveRegionSet([{ id: 'only', readOnly: false }]);
  assert.equal(regions.resilienceSummary().survivesSingleRegionLoss, false);
});

test('P5 rejects a policy with no valid Ed25519 signature', () => {
  const rollout = new RolloutController();
  assert.throws(() => rollout.createSignedPolicy({
    id: 'model-a', version: '1', payload: { id: 'model-a' }, publicKeyPem: 'invalid', signatureBase64: 'invalid',
  }));
});

test('P5 canary cannot advance without healthy evidence', () => {
  const rollout = new RolloutController();
  const signed = signedPolicy({ id: 'model-a', version: '1', rule: 'review' });
  rollout.createSignedPolicy({ id: 'model-a', version: '1', ...signed });
  assert.equal(rollout.promote('model-a').promoted, false);
  assert.equal(rollout.evaluate('model-a', { crashRate: 0.02, falsePositiveRate: 0, sampleSize: 1_000 }).action, 'HOLD');
  assert.equal(rollout.promote('model-a').promoted, false);
});

test('P5 healthy evidence advances only one rollout stage at a time', () => {
  const rollout = new RolloutController();
  const signed = signedPolicy({ id: 'model-b', version: '1', rule: 'review' });
  rollout.createSignedPolicy({ id: 'model-b', version: '1', ...signed });
  rollout.evaluate('model-b', { crashRate: 0.001, falsePositiveRate: 0.0001, sampleSize: 10_000 });
  const promoted = rollout.promote('model-b');
  assert.equal(promoted.promoted, true);
  assert.equal(promoted.rolloutFraction, 0.05);
});

test('P5 kill switch prevents further promotion', () => {
  const rollout = new RolloutController();
  const signed = signedPolicy({ id: 'engine-a', version: '2', rule: 'block-known-bad' });
  rollout.createSignedPolicy({ id: 'engine-a', version: '2', ...signed });
  rollout.evaluate('engine-a', { crashRate: 0, falsePositiveRate: 0, sampleSize: 10_000 });
  rollout.kill('engine-a', '1');
  assert.equal(rollout.promote('engine-a').promoted, false);
});

test('P6 capacity claim starts at zero without measured evidence', () => {
  const ledger = new CapacityEvidenceLedger();
  assert.equal(ledger.highestVerifiedCapacity(), 0);
  assert.equal(ledger.canClaim(1_000), false);
});

test('P6 capacity evidence must be contiguous through the ladder', () => {
  const ledger = new CapacityEvidenceLedger();
  recordPassingCapacityStage(ledger, 1_000, 'e1');
  recordPassingCapacityStage(ledger, 100_000, 'e3');
  assert.equal(ledger.highestVerifiedCapacity(), 1_000);
  assert.equal(ledger.canClaim(100_000), false);
  assert.equal(ledger.nextRequiredStage(), 10_000);
});

test('P6 billion-scale flag remains false until the full measured evidence ladder passes', () => {
  const ledger = new CapacityEvidenceLedger();
  recordPassingCapacityStage(ledger, 1_000, 'e1');
  assert.equal(ledger.summary().billionScaleVerified, false);
});
