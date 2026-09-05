import test from 'node:test';
import assert from 'node:assert/strict';

import { ProtectionState } from '../contracts.mjs';
import { SecurityBroker } from '../p1-security-broker.mjs';
import { RegionalEdgeRouter } from '../p2-edge-router.mjs';
import { evaluateBackpressure } from '../p2-backpressure.mjs';
import { ActiveActiveRegionSet } from '../p4-active-active.mjs';
import { evaluatePartition } from '../p4-partition-policy.mjs';
import { RolloutController } from '../p5-rollout-control.mjs';
import { CapacityEvidenceLedger } from '../p6-capacity-evidence.mjs';
import { signedPolicy } from './test-crypto.mjs';

const TRUST = 'publisher-sha256:laneriq-test';

test('Fault: stale Guardian proof fails closed before Broker exposure', () => {
  const now = 1_000_000;
  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => now });
  const status = broker.registerGuardianProof({
    installationId: 'd', sessionId: 's', publisherDigest: TRUST,
    leaseEpoch: 1, heartbeatSequence: 1,
    heartbeatAtMs: now - 200_000, leaseExpiresAtMs: now - 100_000,
    bootSessionId: 'boot', expectedBootSessionId: 'boot', userOptedIn: true, serviceEnabled: true,
  });
  assert.notEqual(status.state, ProtectionState.ACTIVE);
  assert.notEqual(broker.status().state, ProtectionState.ACTIVE);
});

test('Fault: all regional edges unhealthy returns no route rather than silently picking a dead node', () => {
  const router = new RegionalEdgeRouter({ regions: [{ id: 'a', healthy: false }, { id: 'b', healthy: false }] });
  const route = router.route({ preferredRegion: 'a', write: true });
  assert.equal(route.region, null);
  assert.equal(route.reason, 'no_healthy_region');
});

test('Fault: saturated edge queue enters rejection state for noncritical work', () => {
  const pressure = evaluateBackpressure({ queueDepth: 1000, queueCapacity: 1000, oldestAgeMs: 180_000 });
  assert.equal(pressure.allowOptional, false);
  assert.equal(pressure.allowCritical, true);
});

test('Fault: one region evacuated keeps another writable region available', () => {
  const regions = new ActiveActiveRegionSet([
    { id: 'a', group: 'sea', load: 0.1 },
    { id: 'b', group: 'sea', load: 0.2 },
  ]);
  regions.evacuate('a', true);
  assert.equal(regions.select({ preferredGroup: 'sea', write: true }).region, 'b');
});

test('Fault: global control loss freezes policy promotion', () => {
  const partition = evaluatePartition({ regionalDataPlaneHealthy: true, globalControlReachable: false, signedSnapshotFresh: true });
  assert.equal(partition.allowPolicyPromotion, false);
});

test('Fault: unhealthy canary evidence cannot advance a signed rollout', () => {
  const rollout = new RolloutController();
  const signed = signedPolicy({ id: 'engine', version: '1', rule: 'review' });
  rollout.createSignedPolicy({ id: 'engine', version: '1', ...signed });
  rollout.evaluate('engine', { crashRate: 0.02, falsePositiveRate: 0.01, sampleSize: 50_000 });
  assert.equal(rollout.promote('engine').promoted, false);
});

test('Fault: out-of-order capacity evidence cannot skip an unverified stage', () => {
  const ledger = new CapacityEvidenceLedger();
  ledger.record({ users: 1_000, passed: true, evidenceId: '1k' });
  ledger.record({ users: 100_000, passed: true, evidenceId: '100k' });
  ledger.record({ users: 1_000_000, passed: true, evidenceId: '1m' });
  assert.equal(ledger.highestVerifiedCapacity(), 1_000);
  assert.equal(ledger.nextRequiredStage(), 10_000);
  assert.equal(ledger.summary().billionScaleVerified, false);
});
