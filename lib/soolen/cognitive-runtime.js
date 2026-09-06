import crypto from "node:crypto";
import { createCognitiveRun, createFailureMemoryRecord, evaluateCognitiveResult, EVIDENCE_CLASSES } from "./cognitive-os.js";

export const LANERIQ_COGNITIVE_RUNTIME_VERSION = "1.1.0";

function text(value,max=12000){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function parseJsonObject(raw){
  const cleaned=text(raw,50000).replace(/```json/gi,"").replace(/```/g,"").trim();
  const a=cleaned.indexOf("{"); const b=cleaned.lastIndexOf("}");
  if(a<0||b<a) return null;
  try{const parsed=JSON.parse(cleaned.slice(a,b+1));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;}catch{return null;}
}

function rolePrompt(goal,role,evidence=""){
  return `LANERIQ Cognitive Council independent round.\nROLE: ${role.id}\nPURPOSE: ${role.purpose}\nGOAL: ${goal}\nEVIDENCE SUMMARY: ${text(evidence,6000)||"None supplied."}\nDo not assume another council member's answer. Identify assumptions, risks, unknowns and a recommended approach. Return strict JSON: {"summary":"","recommendation":"","assumptions":[],"risks":[],"unknowns":[],"confidence":0.0}`;
}

function judgePrompt(goal,candidates){
  const safeCandidates=candidates.map(c=>({role:c.role,summary:c.output?.summary||"",recommendation:c.output?.recommendation||"",assumptions:c.output?.assumptions||[],risks:c.output?.risks||[],unknowns:c.output?.unknowns||[],confidence:c.output?.confidence??0,responseDigest:c.responseDigest,providerClass:c.provider||""}));
  return `LANERIQ Cognitive Council judge round.\nGOAL: ${goal}\nCANDIDATES: ${JSON.stringify(safeCandidates)}\nCompare evidence, contradictions, reversibility, security, cost and execution risk. Never convert simulated/internal claims into Production evidence. Return strict JSON: {"winnerRole":"","decision":"","rationale":"","contradictions":[],"unknowns":[],"confidence":0.0,"requiresExternalVerification":false}`;
}

async function aiProviderModule(){return import("../../engine/ai-provider.js");}
async function defaultGenerate(prompt,options={}){const { generateWithFallback }=await aiProviderModule();return generateWithFallback(prompt,options);}

async function configuredProviderPool(explicit){
  if(Array.isArray(explicit)&&explicit.length)return [...new Set(explicit.map(v=>text(v,80).toLowerCase()).filter(Boolean))];
  try{
    const { getProviderRuntimeHealth }=await aiProviderModule();
    return getProviderRuntimeHealth().filter(x=>x.configured===true).map(x=>String(x.provider));
  }catch{return[];}
}

export function buildProviderDiversityPolicy(providers=[],workerCount=5){
  const pool=[...new Set((providers||[]).map(v=>text(v,80).toLowerCase()).filter(Boolean))];
  const minDistinct=Math.min(workerCount,Math.max(1,pool.length>=3?3:pool.length));
  return Object.freeze({pool:Object.freeze(pool),workerCount,minDistinct,diversityPossible:pool.length>1,judgeDifferentProviderPreferred:pool.length>1});
}

function rolePool(pool,index,used){
  if(!pool.length)return undefined;
  const unused=pool.filter(p=>!used.has(p));
  if(unused.length)return [...unused,...pool.filter(p=>used.has(p))];
  const offset=index%pool.length;
  return [...pool.slice(offset),...pool.slice(0,offset)];
}

export async function executeCognitiveCouncil(input={},deps={}){
  const run=createCognitiveRun(input);
  if(!run.council) return Object.freeze({runtimeVersion:LANERIQ_COGNITIVE_RUNTIME_VERSION,run,councilExecuted:false,candidates:[],judge:null,providerDiversity:null});
  const generate=typeof deps.generate==="function"?deps.generate:defaultGenerate;
  const workerRoles=run.council.roles.filter(r=>r.id!=="judge");
  const pool=await configuredProviderPool(input.providers);
  const diversityPolicy=buildProviderDiversityPolicy(pool,workerRoles.length);
  const candidates=[];
  const usedProviders=new Set();
  for(let i=0;i<workerRoles.length;i++){
    const role=workerRoles[i];
    const preferredProviders=rolePool(pool,i,usedProviders);
    const response=await generate(rolePrompt(run.goal,role,input.evidenceSummary),{providers:preferredProviders});
    const raw=typeof response==="string"?response:response?.result;
    const provider=typeof response==="object"?text(response?.provider,80):"";
    if(provider)usedProviders.add(provider);
    const output=parseJsonObject(raw)||{summary:text(raw,2000),recommendation:"",assumptions:[],risks:[],unknowns:[],confidence:0};
    candidates.push({role:role.id,provider,responseDigest:digest(raw),output});
  }
  const judgePool=Array.isArray(input.judgeProviders)&&input.judgeProviders.length
    ? [...new Set(input.judgeProviders.map(v=>text(v,80).toLowerCase()).filter(Boolean))]
    : pool.length
      ? [...pool.filter(p=>!usedProviders.has(p)),...pool.filter(p=>usedProviders.has(p))]
      : undefined;
  const judgeResponse=await generate(judgePrompt(run.goal,candidates),{providers:judgePool});
  const judgeRaw=typeof judgeResponse==="string"?judgeResponse:judgeResponse?.result;
  const judgeProvider=typeof judgeResponse==="object"?text(judgeResponse?.provider,80):"";
  if(judgeProvider)usedProviders.add(judgeProvider);
  const judge=parseJsonObject(judgeRaw)||{winnerRole:"",decision:text(judgeRaw,2000),rationale:"",contradictions:[],unknowns:[],confidence:0,requiresExternalVerification:true};
  const distinctProviders=[...usedProviders];
  const providerDiversity=Object.freeze({
    ...diversityPolicy,
    distinctProviders:Object.freeze(distinctProviders),
    distinctProviderCount:distinctProviders.length,
    satisfied:!diversityPolicy.diversityPossible||distinctProviders.length>=diversityPolicy.minDistinct,
    actualProviderDiversityObserved:distinctProviders.length>1,
  });
  return Object.freeze({runtimeVersion:LANERIQ_COGNITIVE_RUNTIME_VERSION,run,councilExecuted:true,candidates,judge:{...judge,responseDigest:digest(judgeRaw),provider:judgeProvider},providerDiversity,evidenceClass:EVIDENCE_CLASSES.INTERNAL,mayClaimProductionVerified:false});
}

export function closeCognitiveRun(input={}){
  const verdict=evaluateCognitiveResult(input);
  const failureMemory=verdict.accepted?null:createFailureMemoryRecord({category:input.category||"cognitive-runtime",failureCode:verdict.failed.join("+")||"COGNITIVE_REJECTED",strategy:text(input.strategy,800),repairPattern:text(input.repairPattern||verdict.action,800),successAfterRepair:false,providerClass:text(input.providerClass,80),runtimeClass:"cognitive-runtime-v1.1"});
  return Object.freeze({verdict,failureMemory});
}
