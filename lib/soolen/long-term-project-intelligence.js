import crypto from "node:crypto";

export const LONG_TERM_PROJECT_INTELLIGENCE_VERSION="1.0.0";
function text(value,max=800){return String(value??"").trim().slice(0,max);}
function sha(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}

export function createProjectIntelligenceRecord(input={}){
  const category=String(input.category||"").toLowerCase();
  if(!["decision","preference","failure","workflow","goal","architecture"].includes(category))throw new Error("LANERIQ_PROJECT_INTELLIGENCE_CATEGORY_INVALID");
  const summary=text(input.summary,1200);if(!summary)throw new Error("LANERIQ_PROJECT_INTELLIGENCE_SUMMARY_REQUIRED");
  if(input.rawSecret||input.credentials||input.privateKey||input.rawCustomerPayload)throw new Error("LANERIQ_PROJECT_INTELLIGENCE_PRIVATE_DATA_FORBIDDEN");
  const sourceDigest=sha(JSON.stringify(input.sourceRefs||[]));
  const record={recordId:`pi_${sha(`${category}:${summary}:${sourceDigest}`).slice(0,24)}`,category,summary,sourceDigest,confidence:Math.max(0,Math.min(1,Number(input.confidence)||.5)),createdAt:new Date(input.createdAt||Date.now()).toISOString(),expiresAt:input.expiresAt?new Date(input.expiresAt).toISOString():null,projectScoped:true,privateByDefault:true,rawCustomerPayloadStored:false,rawSecretsStored:false};
  return Object.freeze(record);
}

export function buildProjectIntelligenceContext(records=[],input={}){
  const now=Date.now();const max=Math.max(1,Math.min(50,Number(input.maxRecords)||20));
  const usable=(Array.isArray(records)?records:[]).filter(row=>row&&(!row.expiresAt||Date.parse(row.expiresAt)>now)).sort((a,b)=>(b.confidence||0)-(a.confidence||0)).slice(0,max);
  const byCategory=Object.fromEntries(["decision","preference","failure","workflow","goal","architecture"].map(category=>[category,usable.filter(row=>row.category===category).map(row=>Object.freeze({recordId:row.recordId,summary:row.summary,confidence:row.confidence,sourceDigest:row.sourceDigest}))]));
  return Object.freeze({version:LONG_TERM_PROJECT_INTELLIGENCE_VERSION,recordCount:usable.length,byCategory:Object.freeze(byCategory),contextDigest:sha(JSON.stringify(byCategory)),privateByDefault:true,crossUserReuseAllowed:false,rawChainOfThoughtStored:false});
}

export function evaluateMemoryConflict(records=[]){
  const groups=new Map();
  for(const row of records||[]){const key=`${row.category}:${String(row.summary||"").toLowerCase().replace(/\s+/g," ").slice(0,80)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  const conflicts=[];
  for(const [key,rows] of groups)if(rows.length>1&&new Set(rows.map(r=>r.sourceDigest)).size>1)conflicts.push(Object.freeze({key,recordIds:Object.freeze(rows.map(r=>r.recordId)),requiresReview:true}));
  return Object.freeze({conflictCount:conflicts.length,conflicts:Object.freeze(conflicts),automaticOverwriteAllowed:false});
}

export function planNextProjectActions(context,input={}){
  const goals=context?.byCategory?.goal||[];const failures=context?.byCategory?.failure||[];const workflows=context?.byCategory?.workflow||[];
  const actions=[];
  for(const goal of goals.slice(0,3))actions.push(Object.freeze({type:"advance-goal",referenceId:goal.recordId,summary:goal.summary}));
  for(const failure of failures.slice(0,2))actions.push(Object.freeze({type:"avoid-known-failure",referenceId:failure.recordId,summary:failure.summary}));
  if(!actions.length&&workflows.length)actions.push(Object.freeze({type:"continue-workflow",referenceId:workflows[0].recordId,summary:workflows[0].summary}));
  return Object.freeze({actions:Object.freeze(actions.slice(0,5)),humanConfirmationRequired:input.highImpact===true,automaticProductionActionAllowed:false});
}
