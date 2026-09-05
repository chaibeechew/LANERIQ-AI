export function evaluateCapacityStage({
  observedUsers = 0,
  targetUsers = 0,
  peakRps = 0,
  provisionedRps = 0,
  p95Ms = Infinity,
  maxP95Ms = 500,
  errorRate = 1,
  maxErrorRate = 0.01,
  costPerMillionRequests = Infinity,
  maxCostPerMillionRequests = Infinity,
  durationMinutes = 0,
  minDurationMinutes = 60,
} = {}) {
  const userCoverage = targetUsers > 0 ? observedUsers / targetUsers : 0;
  const headroom = peakRps > 0 ? provisionedRps / peakRps : 0;
  const checks = Object.freeze({
    targetReached: observedUsers >= targetUsers && targetUsers > 0,
    latencyPass: Number.isFinite(p95Ms) && p95Ms <= maxP95Ms,
    errorRatePass: Number.isFinite(errorRate) && errorRate >= 0 && errorRate <= maxErrorRate,
    headroomPass: Number.isFinite(headroom) && headroom >= 1.5,
    costPass: Number.isFinite(costPerMillionRequests) && costPerMillionRequests <= maxCostPerMillionRequests,
    durationPass: durationMinutes >= minDurationMinutes,
  });
  const passed = Object.values(checks).every(Boolean);
  return {
    passed,
    observedUsers,
    targetUsers,
    userCoverage,
    peakRps,
    provisionedRps,
    headroom,
    p95Ms,
    errorRate,
    costPerMillionRequests,
    durationMinutes,
    checks,
  };
}
