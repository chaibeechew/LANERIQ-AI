export const COST_INTELLIGENCE_ENGINE_VERSION="1.0.0";

function n(value,fallback=0){const x=Number(value);return Number.isFinite(x)?x:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,n(value,min)));}

export function createTaskCostBudget(input={}){
  const monthlyBudgetUsd=Math.max(0,n(input.monthlyBudgetUsd,0));
  const remainingMonthlyUsd=Math.max(0,n(input.remainingMonthlyUsd,monthlyBudgetUsd));
  const maxTaskCostUsd=Math.max(0,n(input.maxTaskCostUsd,Math.min(remainingMonthlyUsd,1)));
  return Object.freeze({
    version:COST_INTELLIGENCE_ENGINE_VERSION,
    mode:String(input.mode||"balanced"),
    zeroCost:input.zeroCost===true,
    monthlyBudgetUsd,
    remainingMonthlyUsd,
    maxTaskCostUsd:input.zeroCost===true?0:maxTaskCostUsd,
    premiumFallbackAllowed:input.premiumFallbackAllowed===true&&input.zeroCost!==true,
    surpriseSpendAllowed:false,
    explicitSpendAdmissionRequired:true,
  });
}

export function estimateExecutionCost(input={}){
  const inputTokens=Math.max(0,n(input.inputTokens,0));const outputTokens=Math.max(0,n(input.outputTokens,0));const toolCostUsd=Math.max(0,n(input.toolCostUsd,0));
  const inputCost=inputTokens/1_000_000*Math.max(0,n(input.inputUsdPerMillion,0));
  const outputCost=outputTokens/1_000_000*Math.max(0,n(input.outputUsdPerMillion,0));
  const candidateCount=clamp(input.candidateCount||1,1,8);const verifierPasses=clamp(input.verifierPasses||0,0,4);
  const modelCost=(inputCost+outputCost)*candidateCount*(1+verifierPasses*.35);
  const total=modelCost+toolCostUsd;
  return Object.freeze({inputTokens,outputTokens,candidateCount,verifierPasses,modelCostUsd:Number(modelCost.toFixed(6)),toolCostUsd:Number(toolCostUsd.toFixed(6)),estimatedTotalUsd:Number(total.toFixed(6)),estimateOnly:true});
}

export function admitTaskSpend(budget,estimate,input={}){
  const estimated=Math.max(0,n(estimate?.estimatedTotalUsd,0));const failed=[];
  if(budget?.zeroCost===true&&estimated>0)failed.push("zero-cost-mode");
  if(estimated>n(budget?.maxTaskCostUsd,0))failed.push("task-cost-cap");
  if(estimated>n(budget?.remainingMonthlyUsd,0))failed.push("monthly-budget-remaining");
  if(input.explicitPaidApprovalRequired===true&&estimated>0&&input.paidApproved!==true)failed.push("paid-approval");
  return Object.freeze({allowed:failed.length===0,failed:Object.freeze(failed),estimatedTotalUsd:estimated,maxTaskCostUsd:n(budget?.maxTaskCostUsd,0),remainingMonthlyUsd:n(budget?.remainingMonthlyUsd,0),maySilentlySpend:false});
}

export function optimizeInferenceBudget(input={}){
  const complexity=clamp(input.complexity,0,1);const uncertainty=clamp(input.uncertainty,0,1);const risk=String(input.risk||"normal").toLowerCase();const zeroCost=input.zeroCost===true;
  let candidateCount=complexity>=.8||uncertainty>=.7?4:complexity>=.5||uncertainty>=.4?2:1;
  let verifierPasses=risk==="critical"?3:complexity>=.7?2:1;
  if(zeroCost){candidateCount=Math.min(candidateCount,2);verifierPasses=Math.min(verifierPasses,1);}
  return Object.freeze({candidateCount,verifierPasses,earlyStopEnabled:true,minimumImprovement:Math.max(.01,Math.min(.2,n(input.minimumImprovement,.04))),providerDiversityPreferred:candidateCount>1,costCeilingRequired:true,qualityMayNotBeClaimedWithoutMeasuredEvidence:true});
}

export function summarizeUnitEconomics(samples=[]){
  const rows=(Array.isArray(samples)?samples:[]).filter(Boolean);const total=rows.length;
  const totalCost=rows.reduce((s,r)=>s+Math.max(0,n(r.costUsd,0)),0);const successful=rows.filter(r=>r.success===true).length;
  return Object.freeze({sampleCount:total,totalCostUsd:Number(totalCost.toFixed(6)),successfulTasks:successful,costPerSuccessfulTaskUsd:successful?Number((totalCost/successful).toFixed(6)):null,successRate:total?successful/total:0,minimumMarketSampleSize:100,marketClaimEligible:total>=100,productionClaimAllowed:false});
}
