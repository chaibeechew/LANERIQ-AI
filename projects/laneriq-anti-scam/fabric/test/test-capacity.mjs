export function recordPassingCapacityStage(ledger, users, evidenceId, overrides = {}) {
  return ledger.recordEvaluated({
    users,
    evidenceId,
    observedUsers: users,
    peakRps: 1_000,
    provisionedRps: 1_600,
    p95Ms: 120,
    errorRate: 0.001,
    costPerMillionRequests: 2,
    durationMinutes: 120,
    regionCount: 2,
    ...overrides,
  });
}

export function recordFailingCapacityStage(ledger, users, evidenceId, overrides = {}) {
  return ledger.recordEvaluated({
    users,
    evidenceId,
    observedUsers: users,
    peakRps: 1_000,
    provisionedRps: 1_100,
    p95Ms: 800,
    errorRate: 0.05,
    costPerMillionRequests: 50,
    durationMinutes: 10,
    regionCount: 1,
    ...overrides,
  });
}
