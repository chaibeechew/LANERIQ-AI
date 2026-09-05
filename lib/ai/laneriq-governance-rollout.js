function clean(v,max=96){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
const STAGES=["disabled","shadow","canary","active"];
export const LANERIQ_GOVERNANCE_ROLLOUT_CONTRACT="laneriq-governance-rollout-v1";
export function evaluateGovernanceRollout({currentStage="disabled",targetStage="shadow",risk="normal",reviewerApproved=false,exactShaVerified=false,contractPassed=false,runtimePassed=false,regressionCount=0,canarySampleSize=0}={}){
  const current=STAGES.includes(currentStage)?currentStage:"disabled",target=STAGES.includes(targetStage)?targetStage:"shadow",blockers=[];
  if(STAGES.indexOf(target)>STAGES.indexOf(current)+1)blockers.push("stage-skip-forbidden"); if(contractPassed!==true&&target!=="disabled")blockers.push("contract-evidence-required");
  if(target==="canary"&&runtimePassed!==true)blockers.push("runtime-evidence-required"); if(target==="active"){if(reviewerApproved!==true)blockers.push("human-approval-required");if(exactShaVerified!==true)blockers.push("exact-sha-required");if(runtimePassed!==true)blockers.push("runtime-evidence-required");if(Math.floor(Number(canarySampleSize)||0)<10)blockers.push("canary-sample-required")}
  if(Math.max(0,Math.floor(Number(regressionCount)||0))>0)blockers.push("regression-present"); if(risk==="critical"&&target!=="disabled"&&reviewerApproved!==true)blockers.push("critical-risk-human-approval-required");
  return{contract:LANERIQ_GOVERNANCE_ROLLOUT_CONTRACT,currentStage:current,targetStage:target,allowed:blockers.length===0,blockers,decision:blockers.length?"hold":"advance",automaticPromotion:false};
}
export function nextSafeRolloutStage(stage="disabled"){const i=STAGES.indexOf(stage);return STAGES[Math.min(STAGES.length-1,Math.max(0,i)+1)]||"shadow"}
export const LANERIQ_GOVERNANCE_ROLLOUT_INSTRUCTION=`GOVERNANCE ROLLOUT: new knowledge/control rules move disabled -> shadow -> canary -> active one stage at a time. Active requires human approval, exact-SHA and runtime evidence, a non-trivial canary sample, and zero recorded regression. No automatic Production activation.`;
