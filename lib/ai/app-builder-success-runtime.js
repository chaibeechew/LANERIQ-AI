import crypto from "node:crypto";

export const APP_BUILDER_SUCCESS_RUNTIME_VERSION="1.0.0";
export const APP_BUILDER_SUCCESS_STAGES=Object.freeze(["architecture","generation","build","database","tests","security","preview","publish","rollback"]);

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function text(value,max=160){return String(value??"").trim().slice(0,max);}

export function createAppBuilderAttempt(input={}){
  const attemptId=text(input.attemptId||`attempt-${Date.now()}`,120);const candidateSha=text(input.candidateSha,40).toLowerCase();
  const stages=Object.freeze(Object.fromEntries(APP_BUILDER_SUCCESS_STAGES.map(name=>[name,Object.freeze({status:"PENDING",durationMs:null,evidenceId:null})])));
  const base={version:APP_BUILDER_SUCCESS_RUNTIME_VERSION,attemptId,candidateSha,createdAt:new Date(input.createdAt||Date.now()).toISOString(),stages,productionClaimAllowed:false};
  return Object.freeze({...base,attemptDigest:digest(base)});
}

export function recordAppBuilderStage(attempt,stage,input={}){
  if(!APP_BUILDER_SUCCESS_STAGES.includes(stage))throw new Error("LANERIQ_APP_BUILDER_STAGE_INVALID");
  const status=String(input.status||"").toUpperCase();if(!["PASS","FAIL","SKIP"].includes(status))throw new Error("LANERIQ_APP_BUILDER_STAGE_STATUS_INVALID");
  const updated=Object.freeze({...attempt.stages,[stage]:Object.freeze({status,durationMs:Math.max(0,Number(input.durationMs)||0),evidenceId:text(input.evidenceId,120)||null,reason:text(input.reason,400)||null})});
  const result={...attempt,stages:updated,updatedAt:new Date(input.observedAt||Date.now()).toISOString()};
  return Object.freeze({...result,attemptDigest:digest({attemptId:result.attemptId,stages:result.stages,updatedAt:result.updatedAt})});
}

export function evaluateAppBuilderAttempt(attempt,input={}){
  const required=["architecture","generation","build","database","tests","security","preview"];
  if(input.publishRequired===true)required.push("publish");
  const failed=required.filter(stage=>attempt?.stages?.[stage]?.status!=="PASS");
  const passed=failed.length===0;
  const totalDurationMs=Object.values(attempt?.stages||{}).reduce((sum,row)=>sum+(Number(row?.durationMs)||0),0);
  return Object.freeze({attemptId:attempt?.attemptId,passed,failed:Object.freeze(failed),totalDurationMs,workingAppSuccess:passed,productionPublished:passed&&input.publishRequired===true&&attempt?.stages?.publish?.status==="PASS",rollbackVerified:attempt?.stages?.rollback?.status==="PASS",productionClaimAllowed:false});
}

export function aggregateAppBuilderSuccess(attemptResults=[]){
  const rows=(Array.isArray(attemptResults)?attemptResults:[]).filter(Boolean);const total=rows.length;const successful=rows.filter(row=>row.workingAppSuccess===true).length;const published=rows.filter(row=>row.productionPublished===true).length;const rollback=rows.filter(row=>row.rollbackVerified===true).length;
  const avgDurationMs=total?rows.reduce((sum,row)=>sum+(Number(row.totalDurationMs)||0),0)/total:0;
  return Object.freeze({version:APP_BUILDER_SUCCESS_RUNTIME_VERSION,totalAttempts:total,successfulWorkingApps:successful,workingAppSuccessRate:total?successful/total:0,publishedApps:published,publishSuccessRate:total?published/total:0,rollbackVerifiedCount:rollback,averageTimeToWorkingAppMs:avgDurationMs,minimumMarketClaimSampleSize:100,marketClaimEligible:total>=100,productionClaimAllowed:false});
}

export function createRepairLoopBudget(input={}){
  const maxRounds=Math.max(1,Math.min(5,Number(input.maxRounds)||3));
  return Object.freeze({maxRounds,repairOnlyFailedStages:true,rerunSecurityAfterRepair:true,rerunTestsAfterRepair:true,maySkipFailedRequiredStage:false,mayLowerQualityGate:false,mayAutoPublishProduction:false});
}
