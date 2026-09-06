import crypto from "node:crypto";
import { createCognitiveRun, createFailureMemoryRecord, evaluateCognitiveResult, EVIDENCE_CLASSES } from "./cognitive-os.js";

export const LANERIQ_COGNITIVE_RUNTIME_VERSION = "1.0.0";

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
  const safeCandidates=candidates.map(c=>({role:c.role,summary:c.output?.summary||"",recommendation:c.output?.recommendation||"",assumptions:c.output?.assumptions||[],risks:c.output?.risks||[],unknowns:c.output?.unknowns||[],confidence:c.output?.confidence??0,responseDigest:c.responseDigest}));
  return `LANERIQ Cognitive Council judge round.\nGOAL: ${goal}\nCANDIDATES: ${JSON.stringify(safeCandidates)}\nCompare evidence, contradictions, reversibility, security, cost and execution risk. Never convert simulated/internal claims into Production evidence. Return strict JSON: {"winnerRole":"","decision":"","rationale":"","contradictions":[],"unknowns":[],"confidence":0.0,"requiresExternalVerification":false}`;
}

async function defaultGenerate(prompt,options={}){
  const { generateWithFallback } = await import("../../engine/ai-provider.js");
  return generateWithFallback(prompt,options);
}

export async function executeCognitiveCouncil(input={},deps={}){
  const run=createCognitiveRun(input);
  if(!run.council) return Object.freeze({runtimeVersion:LANERIQ_COGNITIVE_RUNTIME_VERSION,run,councilExecuted:false,candidates:[],judge:null});
  const generate=typeof deps.generate==="function"?deps.generate:defaultGenerate;
  const workerRoles=run.council.roles.filter(r=>r.id!=="judge");
  const candidates=[];
  for(const role of workerRoles){
    const response=await generate(rolePrompt(run.goal,role,input.evidenceSummary),{providers:input.providers});
    const raw=typeof response==="string"?response:response?.result;
    const output=parseJsonObject(raw)||{summary:text(raw,2000),recommendation:"",assumptions:[],risks:[],unknowns:[],confidence:0};
    candidates.push({role:role.id,provider:typeof response==="object"?response?.provider||"":"",responseDigest:digest(raw),output});
  }
  const judgeResponse=await generate(judgePrompt(run.goal,candidates),{providers:input.judgeProviders||input.providers});
  const judgeRaw=typeof judgeResponse==="string"?judgeResponse:judgeResponse?.result;
  const judge=parseJsonObject(judgeRaw)||{winnerRole:"",decision:text(judgeRaw,2000),rationale:"",contradictions:[],unknowns:[],confidence:0,requiresExternalVerification:true};
  return Object.freeze({runtimeVersion:LANERIQ_COGNITIVE_RUNTIME_VERSION,run,councilExecuted:true,candidates,judge:{...judge,responseDigest:digest(judgeRaw),provider:typeof judgeResponse==="object"?judgeResponse?.provider||"":""},evidenceClass:EVIDENCE_CLASSES.INTERNAL,mayClaimProductionVerified:false});
}

export function closeCognitiveRun(input={}){
  const verdict=evaluateCognitiveResult(input);
  const failureMemory=verdict.accepted?null:createFailureMemoryRecord({category:input.category||"cognitive-runtime",failureCode:verdict.failed.join("+")||"COGNITIVE_REJECTED",strategy:text(input.strategy,800),repairPattern:text(input.repairPattern||verdict.action,800),successAfterRepair:false,providerClass:text(input.providerClass,80),runtimeClass:"cognitive-runtime-v1"});
  return Object.freeze({verdict,failureMemory});
}
