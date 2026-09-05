import test from 'node:test';
import assert from 'node:assert/strict';

import { PressureState, evaluateBackpressure, admitByPriority } from '../p2-backpressure.mjs';
import { EvidenceProvenanceLedger } from '../p3-evidence-provenance.mjs';
import { PartitionMode, evaluatePartition } from '../p4-partition-policy.mjs';
import { AuditChain } from '../p5-audit-chain.mjs';
import { evaluateCapacityStage } from '../p6-cost-headroom.mjs';

test('P2 backpressure sheds optional traffic before critical security paths', () => {
  const pressure = evaluateBackpressure({ queueDepth: 850, queueCapacity: 1000, oldestAgeMs: 15_000 });
  assert.equal(pressure.state, PressureState.DEGRADED);
  assert.equal(admitByPriority('normal', pressure).admitted, false);
  assert.equal(admitByPriority('critical', pressure).admitted, true);
});

test('P2 severe pressure still preserves critical admission', () => {
  const pressure = evaluateBackpressure({ queueDepth: 990, queueCapacity: 1000, oldestAgeMs: 180_000 });
  assert.equal(pressure.state, PressureState.REJECT_NONCRITICAL);
  assert.equal(admitByPriority('high', pressure).admitted, true);
});

test('P3 high-risk provenance requires at least two distinct evidence sources', () => {
  const ledger = new EvidenceProvenanceLedger();
  ledger.append({ evidenceId: 'a', eventId: '1', source: 'guardian', sourceVersion: '1' });
  ledger.append({ evidenceId: 'b', eventId: '2', source: 'guardian', sourceVersion: '1' });
  assert.equal(ledger.canSupportHighRiskVerdict(['a', 'b']), false);
  ledger.append({ evidenceId: 'c', eventId: '3', source: 'edge-reputation', sourceVersion: '2026.09' });
  assert.equal(ledger.canSupportHighRiskVerdict(['a', 'c']), true);
});

test('P3 provenance trace fails closed when evidence is missing', () => {
  const ledger = new EvidenceProvenanceLedger();
  ledger.append({ evidenceId: 'a', eventId: '1', source: 'guardian', sourceVersion: '1' });
  assert.equal(ledger.trace(['a', 'missing']).complete, false);
});

test('P4 global control outage keeps regional/local protection but freezes promotion', () => {
  const state = evaluatePartition({ regionalDataPlaneHealthy: true, globalControlReachable: false, signedSnapshotFresh: true });
  assert.equal(state.mode, PartitionMode.GLOBAL_CONTROL_UNAVAILABLE);
  assert.equal(state.allowLocalProtection, true);
  assert.equal(state.allowRegionalWrites, true);
  assert.equal(state.allowPolicyPromotion, false);
});

test('P4 regional data-plane failure never disables local protection', () => {
  const state = evaluatePartition({ regionalDataPlaneHealthy: false, globalControlReachable: true });
  assert.equal(state.mode, PartitionMode.REGION_ISOLATED);
  assert.equal(state.allowLocalProtection, true);
  assert.equal(state.allowRegionalWrites, false);
});

test('P5 audit chain verifies untampered control history', () => {
  const audit = new AuditChain();
  audit.append({ actor: 'release-bot', action: 'CANARY_START', target: 'engine-v1', metadata: { fraction: 0.01 } });
  audit.append({ actor: 'release-bot', action: 'CANARY_PROMOTE', target: 'engine-v1', metadata: { fraction: 0.05 } });
  assert.equal(audit.verify().valid, true);
});

test('P5 copied audit snapshot reveals tampering when reconstructed check differs', () => {
  const audit = new AuditChain();
  audit.append({ actor: 'release-bot', action: 'START', target: 'v1' });
  const snapshot = audit.snapshot();
  snapshot[0].action = 'TAMPERED';
  assert.notEqual(snapshot[0].action, audit.snapshot()[0].action);
  assert.equal(audit.verify().valid, true);
});

test('P6 capacity stage requires 1.5x headroom, latency, error, cost and soak duration gates', () => {
  const result = evaluateCapacityStage({
    observedUsers: 10_000,
    targetUsers: 10_000,
    peakRps: 1_000,
    provisionedRps: 1_600,
    p95Ms: 120,
    maxP95Ms: 300,
    errorRate: 0.002,
    maxErrorRate: 0.01,
    costPerMillionRequests: 4,
    maxCostPerMillionRequests: 5,
    durationMinutes: 120,
    minDurationMinutes: 60,
  });
  assert.equal(result.passed, true);
  assert.ok(result.headroom >= 1.5);
});

test('P6 stage fails if capacity is cheap and fast but lacks headroom', () => {
  const result = evaluateCapacityStage({
    observedUsers: 100_000,
    targetUsers: 100_000,
    peakRps: 10_000,
    provisionedRps: 11_000,
    p95Ms: 80,
    maxP95Ms: 300,
    errorRate: 0.001,
    maxErrorRate: 0.01,
    costPerMillionRequests: 1,
    maxCostPerMillionRequests: 5,
    durationMinutes: 120,
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.headroomPass, false);
});
