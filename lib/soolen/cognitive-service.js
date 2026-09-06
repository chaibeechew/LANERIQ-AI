import { createCognitiveRun, EVIDENCE_CLASSES } from "./cognitive-os.js";
import { executeCognitiveCouncil, closeCognitiveRun } from "./cognitive-runtime.js";

export const LANERIQ_COGNITIVE_SERVICE_VERSION="1.0.0";

export const COGNITIVE_DOMAIN_PROFILES=Object.freeze({
  "app-builder":Object.freeze({taskType:"app-build",complexity:.75,impact:.7,reversibility:.75,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","coding","structured_output","tool_calling"],simulationRequired:true}),
  "malware-defense":Object.freeze({taskType:"security-defense",complexity:.9,impact:.95,reversibility:.5,risk:"high",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","coding","structured_output","tool_calling"],simulationRequired:true}),
  "ai-image":Object.freeze({taskType:"creative-image",complexity:.65,impact:.55,reversibility:.9,risk:"medium",requiresVision:true,requiredCapabilities:["reasoning","vision","structured_output"],simulationRequired:false}),
  "ai-video":Object.freeze({taskType:"creative-video",complexity:.8,impact:.65,reversibility:.85,risk:"medium",requiresVision:true,requiresLongContext:true,requiredCapabilities:["reasoning","vision","multimodal","structured_output"],simulationRequired:true}),
  "production-release":Object.freeze({taskType:"production-release",complexity:1,impact:1,reversibility:.25,risk:"critical",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","coding","structured_output","tool_calling"],simulationRequired:true,production:true,externalSideEffects:true}),
});

function profileFor(domain){const key=String(domain||"").trim().toLowerCase();const profile=COGNITIVE_DOMAIN_PROFILES[key];if(!profile)throw new Error(`LANERIQ_COGNITIVE_DOMAIN_UNSUPPORTED:${key||"empty"}`);return {key,profile};}

export function createDomainCognitiveRun(domain,input={}){
  const {key,profile}=profileFor(domain);
  return createCognitiveRun({...profile,...input,taskType:input.taskType||profile.taskType,goal:input.goal,uncertainty:input.uncertainty||{evidenceCoverage:.6,sourceAgreement:.7,testCoverage:.4,evidenceClass:EVIDENCE_CLASSES.INTERNAL,externalVerificationRequired:key==="production-release"}});
}

export async function executeDomainCognitiveCouncil(domain,input={},deps={}){
  const {profile}=profileFor(domain);
  return executeCognitiveCouncil({...profile,...input,taskType:input.taskType||profile.taskType},deps);
}

export function finalizeDomainCognitiveResult(domain,input={}){
  const {key}=profileFor(domain);
  return closeCognitiveRun({...input,category:input.category||key,critical:input.critical===true||key==="production-release",risk:input.risk||COGNITIVE_DOMAIN_PROFILES[key].risk});
}

export function getCognitiveDomainStatus(){
  return Object.freeze({version:LANERIQ_COGNITIVE_SERVICE_VERSION,domains:Object.keys(COGNITIVE_DOMAIN_PROFILES),providerIndependent:true,productionAutonomyUnbounded:false,productionReleaseRequiresHumanApproval:true,failureMemoryDatabasePersistence:"separate-gated-migration-required"});
}
