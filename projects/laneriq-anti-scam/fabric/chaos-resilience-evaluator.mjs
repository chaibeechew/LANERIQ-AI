const REQUIRED = ['networkDrop','processKill','reboot','clockSkew','providerTimeout','databaseUnavailable','regionLoss','rollback'];

export function evaluateChaosCampaign(cases = []) {
  const byId = new Map((cases || []).map(x => [x?.id, x]));
  const missing = REQUIRED.filter(id => !byId.has(id));
  if (missing.length) return { ready:false, code:'CHAOS_CASES_MISSING', missing };
  const failed = [];
  for (const id of REQUIRED) {
    const c = byId.get(id);
    const bounded = Number.isFinite(c?.recoveryMs) && Number.isFinite(c?.maxRecoveryMs) && c.recoveryMs <= c.maxRecoveryMs;
    const safe = c?.dataLoss === false && c?.securityBoundaryPreserved === true && c?.falseReadyClaim === false;
    if (!(c?.executed === true && c?.passed === true && bounded && safe)) failed.push(id);
  }
  return failed.length ? { ready:false, code:'CHAOS_RESILIENCE_BLOCKED', failed } : { ready:true, code:'CHAOS_RESILIENCE_VERIFIED', caseCount:REQUIRED.length };
}
