function clean(v,max=120){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
const REASONS=new Set(["security-regression","runtime-regression","wrong-exact-sha","policy-conflict","critical-incident","benchmark-regression","manual-rollback"]);
export const LANERIQ_KNOWLEDGE_ROLLBACK_CONTRACT="laneriq-knowledge-rollback-controller-v1";
export function evaluateKnowledgeRollback({currentRevision=null,targetRevision=null,reason="manual-rollback",authorityApproved=false,productionActive=false}={}){
  const blockers=[];const r=REASONS.has(reason)?reason:"manual-rollback";
  if(!currentRevision?.revisionId)blockers.push("current-revision-required");if(!targetRevision?.revisionId)blockers.push("target-revision-required");
  if(currentRevision?.ruleId&&targetRevision?.ruleId&&currentRevision.ruleId!==targetRevision.ruleId)blockers.push("same-rule-required");
  if(Number(targetRevision?.version)>=Number(currentRevision?.version))blockers.push("older-target-required");
  if(!["validated","production_rule"].includes(targetRevision?.status))blockers.push("trusted-target-required");
  if(productionActive===true&&authorityApproved!==true)blockers.push("production-rollback-authority-required");
  return{contract:LANERIQ_KNOWLEDGE_ROLLBACK_CONTRACT,allowed:blockers.length===0,blockers,reason:r,currentRevisionId:clean(currentRevision?.revisionId),targetRevisionId:clean(targetRevision?.revisionId),preserveHistory:true,deleteHistory:false,automaticProductionRollback:false};
}
export function buildRollbackPlan(input={}){const decision=evaluateKnowledgeRollback(input);return{contract:"laneriq-knowledge-rollback-plan-v1",decision,steps:decision.allowed?["freeze-current-revision","activate-known-good-revision","quarantine-regressed-revision","rerun-contract-runtime-evidence","record-rollback-receipt"]:[],requiresPostRollbackVerification:decision.allowed};}
export const LANERIQ_KNOWLEDGE_ROLLBACK_INSTRUCTION=`KNOWLEDGE ROLLBACK: regressions may roll back only to a known-good older validated revision; history is preserved, the bad revision is quarantined, Production rollback requires authority, and contract/runtime evidence must be rerun after rollback.`;
