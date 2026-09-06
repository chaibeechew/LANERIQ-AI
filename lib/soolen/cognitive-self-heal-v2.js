import crypto from "node:crypto";
import { executeCognitiveSelfHeal } from "./cognitive-self-heal.js";

export const COGNITIVE_SELF_HEAL_V2_VERSION="2.0.0";
function text(value,max=500){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

export function classifyCognitiveFailure(input={}){
  const code=text(input.code||input.failureCode,120).toUpperCase();const message=text(input.message,1000).toLowerCase();
  let category="unknown";
  if(/auth|permission|rls|forbidden|unauthorized/.test(`${code} ${message}`))category="authorization";
  else if(/timeout|latency|unavailable|rate/.test(`${code} ${message}`))category="provider-runtime";
  else if(/schema|parse|validation|type/.test(`${code} ${message}`))category="contract";
  else if(/build|compile|syntax|module/.test(`${code} ${message}`))category="build";
  else if(/test|assert|regression/.test(`${code} ${message}`))category="regression";
  else if(/security|malware|unsafe|injection/.test(`${code} ${message}`))category="security";
  return Object.freeze({category,code:code||"UNKNOWN",failureDigest:digest({code,message}),messageStored:false});
}

export function createRootCauseGraph(failures=[]){
  const nodes=(Array.isArray(failures)?failures:[]).slice(0,50).map((failure,index)=>Object.freeze({id:`f${index+1}`,classification:classifyCognitiveFailure(failure),dependsOn:Object.freeze([...(failure?.dependsOn||[])].slice(0,10).map(String))}));
  const roots=nodes.filter(node=>node.dependsOn.length===0).map(node=>node.id);
  return Object.freeze({version:COGNITIVE_SELF_HEAL_V2_VERSION,nodes:Object.freeze(nodes),rootIds:Object.freeze(roots),graphDigest:digest(nodes),rawFailureMessagesStored:false});
}

export function planRepairCandidates(graph,input={}){
  const candidates=[];
  for(const node of graph.nodes||[]){
    const category=node.classification.category;
    const strategy=category==="provider-runtime"?"retry-or-provider-fallback":category==="contract"?"repair-schema-contract":category==="build"?"repair-build-error":category==="regression"?"repair-failed-regression":category==="security"?"quarantine-and-escalate":category==="authorization"?"human-authority-review":"bounded-diagnostic-repair";
    candidates.push(Object.freeze({candidateId:`repair-${node.id}`,failureNodeId:node.id,strategy,automaticAllowed:!["security","authorization"].includes(category),sandboxRequired:true,regressionRequired:true,rollbackRequired:true}));
  }
  return Object.freeze({candidates:Object.freeze(candidates.slice(0,20)),maxRepairRounds:Math.max(1,Math.min(3,Number(input.maxRepairRounds)||3)),mayDisableSafety:false,mayIncreasePermissions:false,mayLowerGate:false});
}

export async function executeCognitiveSelfHealV2(domain,input={},deps={}){
  const graph=createRootCauseGraph(input.failures||[]);const repairPlan=planRepairCandidates(graph,input);
  if(repairPlan.candidates.some(c=>!c.automaticAllowed)&&input.humanApproved!==true)return Object.freeze({accepted:false,action:"human-review-required",graph,repairPlan,productionClaimAllowed:false});
  const result=await executeCognitiveSelfHeal(domain,{...input,maxRounds:repairPlan.maxRepairRounds},{...deps,repair:async(ctx)=>{
    const repair=await deps.repair?.({...ctx,rootCauseGraph:graph,repairCandidates:repairPlan.candidates});
    return {...repair,rollbackAvailable:repair?.rollbackAvailable!==false};
  }});
  return Object.freeze({...result,version:COGNITIVE_SELF_HEAL_V2_VERSION,rootCauseGraph:graph,repairPlan,beforeAfterEvidenceRequired:true,independentRegressionRequired:true,productionClaimAllowed:false});
}
