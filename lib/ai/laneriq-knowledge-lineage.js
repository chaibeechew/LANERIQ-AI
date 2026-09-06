function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
function uniq(xs,max=16){return [...new Set((Array.isArray(xs)?xs:[]).map(x=>clean(x,96)).filter(Boolean))].slice(0,max)}
export const LANERIQ_KNOWLEDGE_LINEAGE_CONTRACT="laneriq-knowledge-lineage-v1";
export function createKnowledgeRevision({ruleId="",version=1,parentRevisionIds=[],evidenceRefs=[],exactSha="",status="candidate",changeSummary=""}={}){
  const id=clean(ruleId,96); if(!id)throw new Error("KNOWLEDGE_RULE_ID_REQUIRED");
  const v=Math.max(1,Math.min(100000,Math.floor(Number(version)||1)));
  return{contract:LANERIQ_KNOWLEDGE_LINEAGE_CONTRACT,ruleId:id,revisionId:`${id}@${v}`,version:v,parentRevisionIds:uniq(parentRevisionIds),evidenceRefs:uniq(evidenceRefs),exactSha:clean(exactSha,64),status:["candidate","validated","production_rule","revoked","quarantined"].includes(status)?status:"candidate",changeSummary:clean(changeSummary,500),immutableHistory:true,mutableInPlace:false};
}
export function validateLineage(revisions=[]){
  const list=Array.isArray(revisions)?revisions:[],ids=new Set(list.map(x=>x?.revisionId).filter(Boolean));
  const errors=[];
  for(const r of list){for(const p of r?.parentRevisionIds||[])if(!ids.has(p))errors.push(`missing-parent:${p}`); if((r?.parentRevisionIds||[]).includes(r?.revisionId))errors.push(`self-parent:${r.revisionId}`)}
  return{contract:"laneriq-knowledge-lineage-check-v1",valid:errors.length===0,errors,revisionCount:list.length};
}
export function chooseRollbackRevision(revisions=[],currentRevisionId=""){
  const list=(Array.isArray(revisions)?revisions:[]).filter(r=>r?.ruleId&&r?.revisionId); const current=list.find(r=>r.revisionId===currentRevisionId); if(!current)return null;
  return list.filter(r=>r.ruleId===current.ruleId&&r.version<current.version&&["validated","production_rule"].includes(r.status)).sort((a,b)=>b.version-a.version)[0]||null;
}
