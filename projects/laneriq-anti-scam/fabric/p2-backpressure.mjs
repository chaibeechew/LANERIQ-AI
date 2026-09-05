export const PressureState = Object.freeze({
  NORMAL: 'NORMAL',
  SHED_OPTIONAL: 'SHED_OPTIONAL',
  DEGRADED: 'DEGRADED',
  REJECT_NONCRITICAL: 'REJECT_NONCRITICAL',
});

export function evaluateBackpressure({ queueDepth = 0, queueCapacity = 1, oldestAgeMs = 0 } = {}) {
  const depth = Math.max(0, Number(queueDepth) || 0);
  const capacity = Math.max(1, Number(queueCapacity) || 1);
  const age = Math.max(0, Number(oldestAgeMs) || 0);
  const utilization = depth / capacity;

  if (utilization >= 0.95 || age >= 120_000) {
    return { state: PressureState.REJECT_NONCRITICAL, utilization, allowCritical: true, allowOptional: false };
  }
  if (utilization >= 0.80 || age >= 60_000) {
    return { state: PressureState.DEGRADED, utilization, allowCritical: true, allowOptional: false };
  }
  if (utilization >= 0.60 || age >= 20_000) {
    return { state: PressureState.SHED_OPTIONAL, utilization, allowCritical: true, allowOptional: false };
  }
  return { state: PressureState.NORMAL, utilization, allowCritical: true, allowOptional: true };
}

export function admitByPriority(priority = 'normal', pressure = {}) {
  const state = pressure.state || PressureState.NORMAL;
  const normalized = String(priority).toLowerCase();
  const critical = normalized === 'critical' || normalized === 'high';
  if (critical) return { admitted: true, reason: 'critical_security_path_preserved' };
  if (state === PressureState.NORMAL) return { admitted: true, reason: 'capacity_available' };
  return { admitted: false, reason: 'backpressure_shed_noncritical' };
}
