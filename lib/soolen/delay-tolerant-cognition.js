export const LANERIQ_DELAY_TOLERANT_COGNITION_VERSION="1.0.0";

function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function text(v,max=500){return String(v??"").trim().slice(0,max);}

export function planDelayTolerantTask(input={}){
  const oneWayLatencySeconds=Math.max(0,num(input.oneWayLatencySeconds,0));
  const disconnectedOperation=oneWayLatencySeconds>30||input.disconnected===true;
  const risk=String(input.risk||"medium").toLowerCase();
  const localAuthorityVerified=input.localAuthorityVerified===true;
  const highRisk=["high","critical"].includes(risk);
  const mayActLocally=!highRisk&&localAuthorityVerified;
  return Object.freeze({taskId:text(input.taskId||"task",160),oneWayLatencySeconds,disconnectedOperation,consensusAssumption:"eventual-not-realtime",mayActLocally,highRiskRemoteActuationAllowed:false,conflictsMustBePreserved:true,reconciliationRequired:true,localSafetyRulesRemainAuthoritative:true,remoteSilenceNeverGrantsAuthority:true});
}

export function reconcileDistributedDecisions(input={}){
  const decisions=Array.isArray(input.decisions)?input.decisions:[];
  const conflicting=new Set(decisions.map(d=>JSON.stringify(d?.decision??null))).size>1;
  return Object.freeze({decisionCount:decisions.length,conflicting,automaticWinner:conflicting?null:(decisions[0]?.decision??null),requiresIndependentReview:conflicting,minorityRecordPreserved:true,highRiskConflictAction:"freeze-and-escalate"});
}
