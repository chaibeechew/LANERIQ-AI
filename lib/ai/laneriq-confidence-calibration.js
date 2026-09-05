function clamp(n,min=0,max=1){const x=Number(n);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min}
export const LANERIQ_CONFIDENCE_CALIBRATION_CONTRACT="laneriq-confidence-calibration-v1";
export function calibrateKnowledgeConfidence({sourceTrust=0,evidenceCount=0,independentEvidenceCount=0,stale=false,contradictionCount=0,exactSha=false,runtimeVerified=false}={}){
  const trust=clamp(sourceTrust),e=Math.max(0,Math.min(20,Math.floor(Number(evidenceCount)||0))),ind=Math.max(0,Math.min(e,Math.floor(Number(independentEvidenceCount)||0))),c=Math.max(0,Math.min(20,Math.floor(Number(contradictionCount)||0)));
  let score=trust*0.55+Math.min(.2,e*.04)+Math.min(.15,ind*.05)+(exactSha?.05:0)+(runtimeVerified?.05:0)-(stale?.3:0)-Math.min(.5,c*.2);
  score=clamp(score); const band=score>=.85?"high":score>=.65?"medium":score>=.4?"low":"insufficient";
  return{contract:LANERIQ_CONFIDENCE_CALIBRATION_CONTRACT,score:Number(score.toFixed(3)),band,productionEligible:band==="high"&&stale!==true&&c===0&&exactSha===true&&runtimeVerified===true,modelConfidenceAuthoritative:false};
}
export const LANERIQ_CONFIDENCE_CALIBRATION_INSTRUCTION=`CONFIDENCE CALIBRATION: confidence is bounded by source trust, evidence diversity, freshness, contradiction state and exact-SHA/runtime proof. Model confidence is never authoritative and cannot promote a claim.`;
