import { evaluateFeatureJudge } from "./feature-judge.js";
import { persistFailureMemory } from "./failure-memory-repository.js";

export const COGNITIVE_SELF_HEAL_VERSION="1.0.0";
const MAX_ROUNDS=3;

function text(value,max=800){return String(value??"").trim().slice(0,max);}
function domainPolicy(domain,input={}){
  const key=String(domain||"").trim().toLowerCase();
  if(key==="production-release")return Object.freeze({automaticRepairAllowed:false,reason:"PRODUCTION_RELEASE_REQUIRES_HUMAN_APPROVAL"});
  if(key==="malware-defense"&&input.deterministicEnforcementUnchanged!==true)return Object.freeze({automaticRepairAllowed:false,reason:"MALWARE_DETERMINISTIC_ENFORCEMENT_MUST_REMAIN_AUTHORITATIVE"});
  return Object.freeze({automaticRepairAllowed:true,reason:"BOUNDED_REPAIR_ALLOWED"});
}

export function planCognitiveSelfHeal(domain,judge,input={}){
  const policy=domainPolicy(domain,input);const failed=[...(judge?.failed||[])].slice(0,30);
  if(judge?.accepted===true)return Object.freeze({version:COGNITIVE_SELF_HEAL_VERSION,required:false,automaticRepairAllowed:false,reason:"ALREADY_ACCEPTED",failed:[]});
  return Object.freeze({version:COGNITIVE_SELF_HEAL_VERSION,required:true,automaticRepairAllowed:policy.automaticRepairAllowed,reason:policy.reason,failed,Object.freeze,maxRounds:Math.max(1,Math.min(MAX_ROUNDS,Number(input.maxRounds)||2)),scope:"failed-checks-only",maySelfGrantPermissions:false,mayDisableSafetyChecks:false,mayLowerQualityGates:false,mayIncreaseEvidenceClassWithoutObservedEvidence:false,rollbackRequired:input.externalSideEffects===true||input.production===true});
}

export async function executeCognitiveSelfHeal(domain,input={},deps={}){
  const initialJudge=input.judge||evaluateFeatureJudge(domain,input.verification||{});
  const plan=planCognitiveSelfHeal(domain,initialJudge,input);
  if(!plan.required)return Object.freeze({version:COGNITIVE_SELF_HEAL_VERSION,accepted:true,rounds:0,judge:initialJudge,plan,history:Object.freeze([])});
  if(!plan.automaticRepairAllowed)return Object.freeze({version:COGNITIVE_SELF_HEAL_VERSION,accepted:false,rounds:0,judge:initialJudge,plan,history:Object.freeze([]),action:"human-review-required"});
  if(typeof deps.repair!=="function"||typeof deps.verify!=="function")throw new Error("LANERIQ_COGNITIVE_SELF_HEAL_EXECUTORS_REQUIRED");
  let judge=initialJudge;const history=[];
  for(let round=1;round<=plan.maxRounds;round+=1){
    const repair=await deps.repair({domain,round,failed:[...judge.failed],scope:"failed-checks-only",maySelfGrantPermissions:false,mayDisableSafetyChecks:false,mayLowerQualityGates:false});
    if(repair?.permissionEscalationRequested===true||repair?.safetyGateDisabled===true||repair?.qualityGateLowered===true)throw new Error("LANERIQ_COGNITIVE_SELF_HEAL_BOUNDARY_VIOLATION");
    const verification=await deps.verify({domain,round,repair,previousJudge:judge});
    judge=evaluateFeatureJudge(domain,verification||{});
    const item=Object.freeze({round,repairApplied:repair?.applied===true,rollbackAvailable:repair?.rollbackAvailable===true,accepted:judge.accepted,failed:Object.freeze([...judge.failed]),observedEvidenceClass:judge.observedEvidenceClass});
    history.push(item);
    if(judge.accepted)break;
  }
  const accepted=judge.accepted===true;
  if(!accepted&&deps.failureMemoryAdapter){
    await persistFailureMemory(deps.failureMemoryAdapter,input.failureMemoryScope||String(domain),{category:`${domain}-self-heal`,failureCode:(judge.failed||[]).join("+").slice(0,120)||"SELF_HEAL_EXHAUSTED",strategy:text(input.strategy||"bounded failed-check repair",800),repairPattern:text(input.repairPattern||"repair failed checks then reverify without lowering gates",800),successAfterRepair:false,providerClass:text(input.providerClass,80),runtimeClass:`cognitive-self-heal-${COGNITIVE_SELF_HEAL_VERSION}`});
  }
  return Object.freeze({version:COGNITIVE_SELF_HEAL_VERSION,accepted,rounds:history.length,judge,plan,history:Object.freeze(history),action:accepted?"accept":"escalate",bounded:true,permissionsEscalated:false,safetyGatesLowered:false});
}
