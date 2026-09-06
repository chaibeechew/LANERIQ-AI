import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const CONTINUOUS_EVALUATION_VERSION="1.0.0";
function text(value,max=160){return String(value??"").trim().slice(0,max);}
function clamp(value,min=0,max=100){return Math.min(max,Math.max(min,Number(value)||0));}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

export function createEvaluationCampaign(input={}){
  const cases=Array.isArray(input.cases)?input.cases:[];
  if(cases.length<1||cases.length>200)throw new Error("LANERIQ_EVAL_CASE_COUNT_OUT_OF_BOUNDS");
  const maxCostUsd=Math.max(0,Number(input.maxCostUsd)||0);const paidSpendAuthorized=input.paidSpendAuthorized===true;
  if(maxCostUsd>0&&!paidSpendAuthorized)throw new Error("LANERIQ_EVAL_PAID_SPEND_NOT_AUTHORIZED");
  const normalized=cases.map((row,index)=>Object.freeze({caseId:text(row.caseId||`case-${index+1}`,120),domain:text(row.domain,80)||"general",risk:text(row.risk,30)||"normal",inputDigest:text(row.inputDigest,64),requiredChecks:Object.freeze([...(row.requiredChecks||[])].map(v=>text(v,80))),externalExecutionRequired:row.externalExecutionRequired===true}));
  return Object.freeze({version:CONTINUOUS_EVALUATION_VERSION,campaignId:text(input.campaignId||`eval-${Date.now()}`,120),cases:Object.freeze(normalized),maxCostUsd,paidSpendAuthorized,productionMutationAllowed:false,automaticDeploymentAllowed:false,humanApprovalBypassAllowed:false,campaignDigest:digest(normalized)});
}

export async function runEvaluationCampaign(campaign={},deps={}){
  if(typeof deps.execute!=="function"||typeof deps.evaluate!=="function")throw new Error("LANERIQ_EVAL_EXECUTE_AND_EVALUATE_REQUIRED");
  const results=[];let externalObserved=false;let totalCostUsd=0;
  for(const item of campaign.cases||[]){
    const started=Date.now();const execution=await deps.execute(item,{campaignId:campaign.campaignId});
    totalCostUsd+=Math.max(0,Number(execution?.costUsd)||0);if(totalCostUsd>Number(campaign.maxCostUsd||0)&&Number(campaign.maxCostUsd||0)>0)throw new Error("LANERIQ_EVAL_COST_BUDGET_EXCEEDED");
    const judgment=await deps.evaluate(item,execution,{campaignId:campaign.campaignId});
    const score=clamp(judgment?.score);const passed=judgment?.passed===true;const actualExternal=execution?.external===true&&execution?.synthetic!==true;externalObserved=externalObserved||actualExternal;
    results.push(Object.freeze({caseId:item.caseId,domain:item.domain,score,passed,externalObserved:actualExternal,durationMs:Math.max(0,Date.now()-started),resultDigest:digest({caseId:item.caseId,score,passed,externalObserved:actualExternal})}));
  }
  const passed=results.filter(row=>row.passed).length;const averageScore=results.reduce((sum,row)=>sum+row.score,0)/Math.max(1,results.length);const passRate=passed/Math.max(1,results.length);
  const evidenceClass=externalObserved?EVIDENCE_CLASSES.MEASURED_OR_ATTESTED:EVIDENCE_CLASSES.INTERNAL;
  return Object.freeze({campaignId:campaign.campaignId,total:results.length,passed,passRate,averageScore,totalCostUsd,evidenceClass,externalObserved,results:Object.freeze(results),productionMutationPerformed:false,mayClaimProductionVerified:false,runDigest:digest(results.map(row=>row.resultDigest))});
}

export function evaluateCampaignReadiness(run={},thresholds={}){
  const minimumPassRate=Math.min(1,Math.max(0,Number(thresholds.minimumPassRate??0.95)));const minimumAverageScore=clamp(thresholds.minimumAverageScore??85);const minimumCases=Math.max(1,Number(thresholds.minimumCases||10));
  const checks=Object.freeze({minimumCases:Number(run.total)>=minimumCases,passRate:Number(run.passRate)>=minimumPassRate,averageScore:Number(run.averageScore)>=minimumAverageScore,externalEvidenceIfRequired:thresholds.externalEvidenceRequired!==true||run.externalObserved===true});
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);return Object.freeze({ready:failed.length===0,checks,failed,evidenceClass:run.evidenceClass||EVIDENCE_CLASSES.INTERNAL,mayPromoteProductionByItself:false});
}
