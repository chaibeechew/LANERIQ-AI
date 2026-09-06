export const INTELLIGENCE_PER_DOLLAR_ROUTER_VERSION="1.0.0";

function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp01(value){return Math.max(0,Math.min(1,number(value,0)));}
function normalizeProvider(row={}){
  return Object.freeze({
    provider:String(row.provider||"").trim().toLowerCase(),
    model:String(row.model||"").trim().slice(0,160),
    configured:row.configured===true,
    liveVerified:row.liveVerified===true,
    quality:clamp01(row.quality),
    reliability:clamp01(row.reliability),
    latencyScore:clamp01(row.latencyScore),
    costScore:clamp01(row.costScore),
    privacyScore:clamp01(row.privacyScore??.8),
    remainingFreeQuota:Math.max(0,number(row.remainingFreeQuota,0)),
    estimatedCostUsd:Math.max(0,number(row.estimatedCostUsd,0)),
  });
}

export function scoreProviderForTask(provider,input={}){
  const p=normalizeProvider(provider);
  if(!p.provider||!p.configured)return Object.freeze({...p,eligible:false,score:-Infinity,reasons:Object.freeze(["not-configured"])});
  const weights={
    quality:clamp01(input.qualityWeight??.38),
    reliability:clamp01(input.reliabilityWeight??.23),
    latency:clamp01(input.latencyWeight??.14),
    cost:clamp01(input.costWeight??.17),
    privacy:clamp01(input.privacyWeight??.08),
  };
  const zeroCost=input.zeroCost===true;
  const costEligible=!zeroCost||p.estimatedCostUsd===0||p.remainingFreeQuota>0;
  const liveRequired=input.liveRequired===true;
  const liveEligible=!liveRequired||p.liveVerified;
  const score=(p.quality*weights.quality+p.reliability*weights.reliability+p.latencyScore*weights.latency+p.costScore*weights.cost+p.privacyScore*weights.privacy)*100;
  const reasons=[];if(!costEligible)reasons.push("zero-cost-policy");if(!liveEligible)reasons.push("live-verification-required");
  return Object.freeze({...p,eligible:costEligible&&liveEligible,score:Number(score.toFixed(3)),reasons:Object.freeze(reasons)});
}

export function selectIntelligencePlan(input={}){
  const providers=(Array.isArray(input.providers)?input.providers:[]).map(row=>scoreProviderForTask(row,input)).filter(row=>row.eligible).sort((a,b)=>b.score-a.score||a.estimatedCostUsd-b.estimatedCostUsd);
  if(!providers.length)return Object.freeze({version:INTELLIGENCE_PER_DOLLAR_ROUTER_VERSION,mode:"blocked",providers:Object.freeze([]),reason:"NO_ELIGIBLE_PROVIDER",maySpend:false});
  const risk=String(input.risk||"normal").toLowerCase();const complexity=clamp01(input.complexity??.5);const uncertainty=clamp01(input.uncertainty??.4);
  let mode="fast";let count=1;
  if(risk==="critical"||input.production===true){mode="verified-critical";count=Math.min(3,providers.length);}
  else if(complexity>=.75||uncertainty>=.65){mode="council";count=Math.min(3,providers.length);}
  else if(complexity>=.5||uncertainty>=.4){mode="deep";count=Math.min(2,providers.length);}
  if(input.zeroCost===true)count=Math.min(count,Math.max(1,providers.filter(p=>p.estimatedCostUsd===0||p.remainingFreeQuota>0).length));
  const selected=providers.slice(0,count);
  const distinctProviders=new Set(selected.map(p=>p.provider)).size;
  if((mode==="council"||mode==="verified-critical")&&distinctProviders<2&&input.requireProviderDiversity!==false){mode="deep";count=1;}
  const finalSelected=selected.slice(0,count);
  return Object.freeze({
    version:INTELLIGENCE_PER_DOLLAR_ROUTER_VERSION,
    mode,
    providers:Object.freeze(finalSelected),
    primary:finalSelected[0]||null,
    distinctProviderCount:new Set(finalSelected.map(p=>p.provider)).size,
    estimatedMaxCostUsd:Number(finalSelected.reduce((sum,p)=>sum+p.estimatedCostUsd,0).toFixed(6)),
    zeroCostRespected:input.zeroCost!==true||finalSelected.every(p=>p.estimatedCostUsd===0||p.remainingFreeQuota>0),
    liveEvidenceObserved:finalSelected.every(p=>p.liveVerified),
    mayClaimBestModelInMarket:false,
    strategy:"maximize-quality-reliability-per-cost-under-policy",
  });
}

export function evaluateRouterOutcome(input={}){
  const baseline=number(input.baselineScore,0);const routed=number(input.routedScore,0);const baselineCost=Math.max(0,number(input.baselineCostUsd,0));const routedCost=Math.max(0,number(input.routedCostUsd,0));
  const qualityDelta=routed-baseline;const costDelta=routedCost-baselineCost;
  return Object.freeze({qualityDelta,costDelta,intelligencePerDollarImproved:qualityDelta>0&&routedCost<=baselineCost||qualityDelta>=5&&routedCost<=baselineCost*1.25,measuredEvidenceRequiredForMarketClaim:true,productionClaimAllowed:false});
}
