function clean(v,max=500){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
const ABSOLUTE=/\b(always|never fails|guaranteed|100% safe|perfect|unlimited|zero risk|production live)\b/i;
const LIVE=/\b(live|production-ready|production live|verified provider|physical device verified)\b/i;
export const LANERIQ_KNOWLEDGE_CONSISTENCY_CONTRACT="laneriq-knowledge-consistency-auditor-v1";
export function auditKnowledgeClaim({claim="",evidenceStage="declared",evidenceCount=0,contradictions=[],stale=false}={}){
  const text=clean(claim),issues=[]; const stage=clean(evidenceStage,40)||"declared"; const n=Math.max(0,Math.floor(Number(evidenceCount)||0));
  if(!text)issues.push("empty-claim"); if(ABSOLUTE.test(text)&&n<2)issues.push("absolute-claim-insufficient-evidence");
  if(LIVE.test(text)&&stage!=="production_live")issues.push("live-claim-exceeds-evidence-stage"); if(stale===true)issues.push("stale-evidence");
  if(Array.isArray(contradictions)&&contradictions.length)issues.push("contradicted-knowledge");
  return{contract:LANERIQ_KNOWLEDGE_CONSISTENCY_CONTRACT,claim:text,evidenceStage:stage,consistent:issues.length===0,issues,mayUseForProduction:issues.length===0&&stage==="production_live"};
}
export function auditKnowledgeSet(items=[]){
  const results=(Array.isArray(items)?items:[]).slice(0,100).map(auditKnowledgeClaim); return{contract:"laneriq-knowledge-set-audit-v1",passed:results.every(r=>r.consistent),results,failedCount:results.filter(r=>!r.consistent).length};
}
export const LANERIQ_KNOWLEDGE_CONSISTENCY_INSTRUCTION=`KNOWLEDGE CONSISTENCY: claims must not exceed evidence stage; absolute claims require corroboration; stale or contradicted knowledge is blocked from Production use; model confidence never substitutes for runtime or exact-SHA evidence.`;
