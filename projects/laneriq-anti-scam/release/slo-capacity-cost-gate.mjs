export function evaluateScaleEvidence(e={}){
  const blockers=[];
  if(!(e.regionsVerified>=2)) blockers.push('MULTI_REGION_EVIDENCE_MISSING');
  if(e.failoverPassed!==true) blockers.push('FAILOVER_NOT_VERIFIED');
  if(!(Number.isFinite(e.p95Ms)&&e.p95Ms<=e.p95BudgetMs)) blockers.push('P95_SLO_FAILED');
  if(!(Number.isFinite(e.errorRate)&&e.errorRate<=e.errorRateBudget)) blockers.push('ERROR_BUDGET_FAILED');
  if(!(Number.isFinite(e.headroomPercent)&&e.headroomPercent>=30)) blockers.push('CAPACITY_HEADROOM_LT_30');
  if(!(Number.isFinite(e.costPer1k)&&Number.isFinite(e.costBudgetPer1k)&&e.costPer1k<=e.costBudgetPer1k)) blockers.push('COST_BUDGET_FAILED');
  if(e.syntheticOnly===true) blockers.push('SYNTHETIC_ONLY_NOT_PRODUCTION_EVIDENCE');
  return {ready:blockers.length===0,blockers};
}
