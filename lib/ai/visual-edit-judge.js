export const VISUAL_EDIT_JUDGE_VERSION="1.0.0";

const DIMENSIONS=Object.freeze({targeting:18,intentFidelity:16,responsive:14,simplicity:14,accessibility:10,visualConsistency:10,functionPreservation:10,authoritySafety:8});

export function judgeVisualEdit({region,intent,patch,responsive,simplicity,candidate={}}={}){
  const checks={
    targeting:Number(region?.confidence||0)>=.65,
    intentFidelity:Boolean(intent?.action&&intent?.object&&patch?.operation),
    responsive:Boolean(responsive?.mobile&&responsive?.desktop&&responsive?.rules?.functionalityLossForbidden),
    simplicity:Boolean(simplicity?.passed),
    accessibility:candidate.accessibilityPreserved!==false,
    visualConsistency:candidate.visualConsistencyPreserved!==false,
    functionPreservation:candidate.functionalityPreserved!==false,
    authoritySafety:Boolean(patch?.safety?.authorityExpansionAllowed===false&&patch?.safety?.clientSuppliedAuthorizationAccepted===false),
  };
  let score=0;for(const [key,weight] of Object.entries(DIMENSIONS))if(checks[key])score+=weight;
  const blockers=[];
  if(!checks.authoritySafety)blockers.push("AUTHORITY_SAFETY_FAILED");
  if(intent?.destructive&&Number(region?.confidence||0)<.8)blockers.push("DESTRUCTIVE_TARGET_NOT_CONFIDENT");
  if(!checks.simplicity)blockers.push("UI_COMPLEXITY_BUDGET_EXCEEDED");
  if(candidate.accessibilityPreserved===false)blockers.push("ACCESSIBILITY_REGRESSION");
  if(candidate.functionalityPreserved===false)blockers.push("FUNCTIONALITY_REGRESSION");
  const passed=score>=92&&blockers.length===0;
  return Object.freeze({version:VISUAL_EDIT_JUDGE_VERSION,score,requiredScore:92,passed,checks:Object.freeze(checks),blockers:Object.freeze(blockers),autoRepairAllowed:!blockers.some(x=>/AUTHORITY|DESTRUCTIVE/.test(x)),productionClaimAllowed:false});
}
