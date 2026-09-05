import test from 'node:test';
import assert from 'node:assert/strict';

import { ProtectionState, RiskLevel } from '../contracts.mjs';
import { SecurityBroker } from '../p1-security-broker.mjs';
import { RegionalEdgeRouter } from '../p2-edge-router.mjs';
import { SecurityEventGraph } from '../p3-event-graph.mjs';
import { ActiveActiveRegionSet } from '../p4-active-active.mjs';
import { RolloutController } from '../p5-rollout-control.mjs';
import { CapacityEvidenceLedger } from '../p6-capacity-evidence.mjs';

const TRUST = 'publisher-sha256:laneriq-test';

test('P0-P6 end-to-end: fresh Guardian -> trusted Broker -> edge failover -> correlated incident -> staged policy -> evidence-capped capacity', () => {
  const now = 2_000_000;

  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => now });
  const guardian = broker.registerGuardianProof({
    installationId: 'device-42',
    sessionId: 'guardian-session-7',
    publisherDigest: TRUST,
    leaseEpoch: 7,
    heartbeatSequence: 12,
    heartbeatAtMs: now - 5_000,
    leaseExpiresAtMs: now + 60_000,
    bootSessionId: 'boot-9',
    expectedBootSessionId: 'boot-9',
    userOptedIn: true,
    serviceEnabled: true,
  });
  assert.equal(guardian.state, ProtectionState.ACTIVE);

  const client = broker.admitRequest({
    clientPackage: 'ai.laneriq.builder',
    publisherDigest: TRUST,
    operation: 'submit_security_signal',
    fingerprint: 'incident-42',
  });
  assert.equal(client.admitted, true);

  const edge = new RegionalEdgeRouter({
    regions: [{ id: 'sea-a', priority: 1 }, { id: 'jp-a', priority: 2 }],
    now: () => now,
  });
  edge.markHealth('sea-a', false, false);
  assert.equal(edge.route({ preferredRegion: 'sea-a', write: true }).region, 'jp-a');

  const graph = new SecurityEventGraph();
  graph.add({ eventId: 'evt-1', installationId: 'device-42', type: 'unknown_apk', occurredAtMs: now - 4_000, source: 'guardian' });
  graph.add({ eventId: 'evt-2', installationId: 'device-42', type: 'accessibility_enabled', occurredAtMs: now - 3_000, source: 'guardian' });
  graph.add({ eventId: 'evt-3', installationId: 'device-42', type: 'remote_control_signal', occurredAtMs: now - 2_000, source: 'guardian' });
  graph.add({ eventId: 'evt-4', installationId: 'device-42', type: 'banking_context', occurredAtMs: now - 1_000, source: 'app' });
  const incident = graph.incidentFor({ installationId: 'device-42', nowMs: now });
  assert.equal(incident.risk, RiskLevel.HIGH);
  assert.equal(incident.malwareVerdict, false);

  const regions = new ActiveActiveRegionSet([
    { id: 'sea-a', group: 'sea', healthy: false },
    { id: 'sea-b', group: 'sea', healthy: true, readOnly: false, load: 0.2, latencyMs: 20 },
    { id: 'jp-a', group: 'jp', healthy: true, readOnly: false, load: 0.1, latencyMs: 40 },
  ]);
  assert.equal(regions.select({ preferredGroup: 'sea', write: true }).region, 'sea-b');

  const rollout = new RolloutController();
  rollout.createPolicy({ id: 'remote-control-correlation', version: 'v1', signatureVerified: true });
  rollout.evaluate('remote-control-correlation', { crashRate: 0.001, falsePositiveRate: 0.0002, sampleSize: 25_000 });
  assert.equal(rollout.promote('remote-control-correlation').rolloutFraction, 0.05);

  const capacity = new CapacityEvidenceLedger();
  capacity.record({ users: 1_000, peakRps: 100, p95Ms: 80, errorRate: 0.001, regionCount: 1, durationMinutes: 60, passed: true, evidenceId: 'load-1k' });
  assert.equal(capacity.canClaim(1_000), true);
  assert.equal(capacity.canClaim(10_000), false);
  assert.equal(capacity.summary().billionScaleVerified, false);
});

test('P0-P1 end-to-end fails closed when boot session changes', () => {
  const now = 3_000_000;
  const broker = new SecurityBroker({ trustedPublisherDigest: TRUST, now: () => now });
  const guardian = broker.registerGuardianProof({
    installationId: 'device-x', sessionId: 's', publisherDigest: TRUST,
    leaseEpoch: 1, heartbeatSequence: 1, heartbeatAtMs: now - 1_000, leaseExpiresAtMs: now + 60_000,
    bootSessionId: 'old-boot', expectedBootSessionId: 'new-boot', userOptedIn: true, serviceEnabled: true,
  });
  assert.notEqual(guardian.state, ProtectionState.ACTIVE);
  assert.notEqual(broker.status().state, ProtectionState.ACTIVE);
});
