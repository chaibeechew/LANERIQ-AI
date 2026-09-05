const CAPACITY_LADDER = Object.freeze([1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000]);

export class CapacityEvidenceLedger {
  constructor() {
    this.records = new Map();
  }

  record({ users, peakRps, p95Ms, errorRate, regionCount, durationMinutes, passed, evidenceId } = {}) {
    users = Number(users);
    if (!CAPACITY_LADDER.includes(users)) throw new Error('users must match a capacity evidence ladder stage');
    if (typeof evidenceId !== 'string' || evidenceId.trim() === '') throw new Error('evidenceId required');
    const record = Object.freeze({
      users,
      peakRps: Number(peakRps) || 0,
      p95Ms: Number(p95Ms) || 0,
      errorRate: Number(errorRate),
      regionCount: Number(regionCount) || 0,
      durationMinutes: Number(durationMinutes) || 0,
      passed: passed === true,
      evidenceId: evidenceId.trim(),
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
      truth: 'Architecture targets are not capacity evidence. Claims are capped at the highest contiguous passed stage.',
    };
  }
}

export { CAPACITY_LADDER };
