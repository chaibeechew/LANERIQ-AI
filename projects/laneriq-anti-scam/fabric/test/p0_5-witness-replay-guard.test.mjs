import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GuardianWitnessReplayGuard,
  ReplayDecision,
} from '../p0_5-witness-replay-guard.mjs';

function hb(overrides = {}) {
  return {
    devicePseudonym: 'p1',
    leaseEpoch: 7,
    heartbeatSequence: 10,
    observedAtMs: 1_000_000,
    ...overrides,
  };
}

test('P0.5 anti-replay accepts first fresh heartbeat', () => {
  const guard = new GuardianWitnessReplayGuard();
  const result = guard.evaluate(hb(), { nowMs: 1_000_500 });
  assert.equal(result.decision, ReplayDecision.ACCEPT);
  assert.equal(result.accepted, true);
});

test('P0.5 anti-replay rejects same sequence replay in same epoch', () => {
  const guard = new GuardianWitnessReplayGuard();
  assert.equal(guard.evaluate(hb(), { nowMs: 1_000_500 }).accepted, true);
  const replay = guard.evaluate(hb({ observedAtMs: 1_001_000 }), { nowMs: 1_001_100 });
  assert.equal(replay.decision, ReplayDecision.REJECT_SEQUENCE_REPLAY);
  assert.equal(replay.accepted, false);
});

test('P0.5 anti-replay accepts increasing sequence in same epoch', () => {
  const guard = new GuardianWitnessReplayGuard();
  guard.evaluate(hb(), { nowMs: 1_000_500 });
  const next = guard.evaluate(hb({ heartbeatSequence: 11, observedAtMs: 1_001_000 }), { nowMs: 1_001_100 });
  assert.equal(next.decision, ReplayDecision.ACCEPT);
});

test('P0.5 anti-replay rejects epoch rollback even with larger sequence', () => {
  const guard = new GuardianWitnessReplayGuard();
  guard.evaluate(hb({ leaseEpoch: 8, heartbeatSequence: 2 }), { nowMs: 1_000_500 });
  const rollback = guard.evaluate(
    hb({ leaseEpoch: 7, heartbeatSequence: 999, observedAtMs: 1_001_000 }),
    { nowMs: 1_001_100 },
  );
  assert.equal(rollback.decision, ReplayDecision.REJECT_EPOCH_ROLLBACK);
});

test('P0.5 anti-replay accepts a new epoch with reset positive sequence', () => {
  const guard = new GuardianWitnessReplayGuard();
  guard.evaluate(hb({ leaseEpoch: 7, heartbeatSequence: 50 }), { nowMs: 1_000_500 });
  const restarted = guard.evaluate(
    hb({ leaseEpoch: 8, heartbeatSequence: 1, observedAtMs: 1_001_000 }),
    { nowMs: 1_001_100 },
  );
  assert.equal(restarted.decision, ReplayDecision.ACCEPT);
});

test('P0.5 anti-replay rejects stale heartbeat', () => {
  const guard = new GuardianWitnessReplayGuard({ maxAgeMs: 10_000 });
  const stale = guard.evaluate(hb({ observedAtMs: 1_000_000 }), { nowMs: 1_020_001 });
  assert.equal(stale.decision, ReplayDecision.REJECT_STALE);
});

test('P0.5 anti-replay rejects future-dated heartbeat', () => {
  const guard = new GuardianWitnessReplayGuard({ maxFutureSkewMs: 5_000 });
  const future = guard.evaluate(hb({ observedAtMs: 1_010_001 }), { nowMs: 1_000_000 });
  assert.equal(future.decision, ReplayDecision.REJECT_FUTURE);
});

test('P0.5 anti-replay tracks pseudonyms independently', () => {
  const guard = new GuardianWitnessReplayGuard();
  assert.equal(guard.evaluate(hb({ devicePseudonym: 'p1' }), { nowMs: 1_000_100 }).accepted, true);
  assert.equal(guard.evaluate(hb({ devicePseudonym: 'p2' }), { nowMs: 1_000_100 }).accepted, true);
});
