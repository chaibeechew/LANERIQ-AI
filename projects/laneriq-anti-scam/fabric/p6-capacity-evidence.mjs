import { evaluateCapacityStage } from './p6-cost-headroom.mjs';

const CAPACITY_LADDER = Object.freeze([1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000]);

export class CapacityEvidenceLedger {
  constructor({ maxP95Ms = 500, maxErrorRate = 0.01, maxCostPerMillionRequests = 10, minDurationMinutes = 60 } = {}) {
    this.records = new Map();
    this.gates = Object.freeze({ maxP95Ms, maxErrorRate, maxCostPerMillionRequests, minDurationMinutes });
  }

  recordEvaluated({
    users,
    evidenceId,
    observedUsers = users,
    peakRps,
    provisionedRps,
    p95Ms,
    errorRate,
    costPerMillionRequests,
    durationMinutes,
    regionCount = 1,
  } = {}) {
    users = Number(users);
    if (!CAPACITY_LADDER.includes(users)) throw new Error('users must match a capacity evidence ladder stage');
    if (typeof evidenceId !== 'string' || evidenceId.trim() === '') throw new Error('evidenceId required');

    const assessment = evaluateCapacityStage({
      observedUsers,
      targetUsers: users,
      peakRps,
      provisionedRps,
      p95Ms,
      maxP95Ms: this.gates.maxP95Ms,
      errorRate,
      maxErrorRate: this.gates.maxErrorRate,
      costPerMillionRequests,
      maxCostPerMillionRequests: this.gates.maxCostPerMillionRequests,
      durationMinutes,
      minDurationMinutes: this.gates.minDurationMinutes,
    });

    const record = Object.freeze({
      users,
      evidenceId: evidenceId.trim(),
      regionCount: Number(regionCount) || 0,
      passed: assessment.passed,
      assessment,
    });
    this.records.set(users, record);
    return record;
  }

  highestVerifiedCapacity() {
    let highest = 0;
    for (const users of CAPACITY_LADDER) {
      const record = this.records.get(users);
      if (!record?.passed) break;
      highest = users;
    }
    return highest;
  }

  canClaim(users) {
    users = Number(users);
    return users > 0 && users <= this.highestVerifiedCapacity();
  }

  nextRequiredStage() {
    const highest = this.highestVerifiedCapacity();
    return CAPACITY_LADDER.find((n) => n > highest) || null;
  }

  summary() {
    return {
      targetUsers: 1_000_000_000,
      highestVerifiedUsers: this.highestVerifiedCapacity(),
      nextRequiredUsers: this.nextRequiredStage(),
      billionScaleVerified: this.highestVerifiedCapacity() === 1_000_000_000,
      evidenceStages: CAPACITY_LADDER.map((users) => ({ users, record: this.records.get(users) || null })),
      truth: 'Architecture targets are not capacity evidence. A stage passes only through measured latency, errors, >=1.5x headroom, cost and soak gates, and claims are capped at the highest contiguous passed stage.',
    };
  }
}

export { CAPACITY_LADDER };
