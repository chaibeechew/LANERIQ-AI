export const ADAPTIVE_INFERENCE_CONTROL_VERSION="1.0.0";

function clamp(v,min=0,max=1){const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min));}
function integer(v,min,max,fallback){const n=Number(v);return Math.min(max,Math.max(min,Math.round(Number.isFinite(n)?n:fallback)));}
function risk(value){const v=String(value||"medium").toLowerCase();return ["low","medium","high","critical"].includes(v)?v:"medium";}

export function planAdaptiveInference(input={}){
  const complexity=clamp(input.complexity??.5);
  const uncertainty=clamp(input.uncertainty??.5);
  const impact=clamp(input.impact??.5);
  const r=risk(input.risk);
  const zeroCost=input.zeroCost===true;
  const hardCap=integer(input.maxParallelCandidates,1,16,8);
  let candidates=1;
  let verifierPasses=1;
  let maxRounds=1;
  if(complexity>=.4||uncertainty>=.3){candidates=2;verifierPasses=1;maxRounds=2;}
  if(complexity>=.75||uncertainty>=.55||impact>=.75||r==="high"){candidates=5;verifierPasses=2;maxRounds=3;}
  if(r==="critical"||(impact>=.9&&uncertainty>=.4)){candidates=8;verifierPasses=3;maxRounds=4;}
  if(zeroCost)candidates=Math.min(candidates,3);
  candidates=Math.min(candidates,hardCap);
  const providerDiversityTarget=Math.min(candidates,integer(input.availableProviderCount,1,16,1));
  return Object.freeze({
    version:ADAPTIVE_INFERENCE_CONTROL_VERSION,
    strategy:"generate-verify-select-with-early-stop",
    parallelCandidates:candidates,
    verifierPasses,
    maxRounds,
    providerDiversityTarget,
    earlyStopConfidence:clamp(input.earlyStopConfidence??(r==="critical"?.94:.88),.5,.999),
    minimumScoreImprovement:clamp(input.minimumScoreImprovement??.02,0,.25),
    monitorComputeRatio:clamp(input.monitorComputeRatio??(r==="critical"?.5:.25),.1,1),
    sandboxRequired:input.requiresTools===true||r==="high"||r==="critical",
    humanApprovalRequired:r==="critical"||input.production===true||input.destructive===true,
    mayIncreasePermissions:false,
    maySelfPromoteEvidence:false,
    budgetBounded:true,
  });
}

export function rankVerifiedCandidates(candidates=[]){
  if(!Array.isArray(candidates))throw new Error("LANERIQ_INFERENCE_CANDIDATES_ARRAY_REQUIRED");
  const rows=candidates.map((item,index)=>{
    const correctness=clamp(item?.correctness??0);
    const security=clamp(item?.security??0);
    const evidence=clamp(item?.evidence??0);
    const calibration=clamp(item?.calibration??0);
    const reversibility=clamp(item?.reversibility??.5);
    const costPenalty=clamp(item?.costPenalty??0);
    const score=correctness*.34+security*.24+evidence*.18+calibration*.12+reversibility*.12-costPenalty*.15;
    return Object.freeze({id:String(item?.id||`candidate-${index+1}`).slice(0,120),score:clamp(score),correctness,security,evidence,calibration,reversibility,costPenalty});
  }).sort((a,b)=>b.score-a.score);
  return Object.freeze(rows);
}

export function shouldContinueInference(history=[],plan={}){
  if(!Array.isArray(history)||history.length===0)return true;
  const rounds=Math.max(1,Number(plan.maxRounds)||1);
  if(history.length>=rounds)return false;
  const latest=history[history.length-1]||{};
  if(clamp(latest.confidence)>=clamp(plan.earlyStopConfidence??.88))return false;
  if(history.length>=2){
    const previous=history[history.length-2]||{};
    const improvement=clamp(latest.bestScore)-clamp(previous.bestScore);
    if(improvement<clamp(plan.minimumScoreImprovement??.02))return false;
  }
  return true;
}
