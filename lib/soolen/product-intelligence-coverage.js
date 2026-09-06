import { SOOLEN_CAPABILITIES } from "./capability-registry.js";
import { createCognitiveRun, EVIDENCE_CLASSES } from "./cognitive-os.js";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const LANERIQ_PRODUCT_INTELLIGENCE_COVERAGE_VERSION="1.0.0";
const LAW=getHumanCivilizationLaw();

const SURFACE_PROFILES=Object.freeze({
  "general-assistant":Object.freeze({taskType:"assistant",complexity:.55,impact:.5,reversibility:.95,risk:"medium",requiresLongContext:true,requiredCapabilities:["reasoning","structured_output"],simulationRequired:false}),
  "app-builder":Object.freeze({taskType:"app-build",complexity:.75,impact:.7,reversibility:.75,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","coding","structured_output","tool_calling"],simulationRequired:true}),
  "ai-image":Object.freeze({taskType:"creative-image",complexity:.65,impact:.55,reversibility:.9,risk:"medium",requiresVision:true,requiredCapabilities:["reasoning","vision","structured_output"],simulationRequired:false}),
  "ai-video":Object.freeze({taskType:"creative-video",complexity:.8,impact:.65,reversibility:.85,risk:"medium",requiresVision:true,requiresLongContext:true,requiredCapabilities:["reasoning","vision","multimodal","structured_output"],simulationRequired:true}),
  "voice":Object.freeze({taskType:"voice",complexity:.6,impact:.55,reversibility:.9,risk:"medium",requiredCapabilities:["reasoning","multimodal","structured_output"],simulationRequired:false}),
  "memory":Object.freeze({taskType:"memory",complexity:.75,impact:.8,reversibility:.7,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","structured_output","tool_calling"],simulationRequired:true}),
  "research-browser":Object.freeze({taskType:"research",complexity:.8,impact:.65,reversibility:.95,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","tool_calling","long_context","structured_output"],simulationRequired:true}),
  "documents":Object.freeze({taskType:"documents",complexity:.75,impact:.65,reversibility:.85,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","tool_calling","long_context","structured_output"],simulationRequired:true}),
  "automations":Object.freeze({taskType:"automation",complexity:.85,impact:.9,reversibility:.5,risk:"high",requiresTools:true,requiresLongContext:true,externalSideEffects:true,requiredCapabilities:["reasoning","tool_calling","structured_output"],simulationRequired:true}),
  "connectors":Object.freeze({taskType:"connector-action",complexity:.85,impact:.9,reversibility:.55,risk:"high",requiresTools:true,requiresLongContext:true,externalSideEffects:true,requiredCapabilities:["reasoning","tool_calling","structured_output"],simulationRequired:true}),
  "communications":Object.freeze({taskType:"communications",complexity:.75,impact:.8,reversibility:.7,risk:"medium",requiresTools:true,externalSideEffects:true,requiredCapabilities:["reasoning","tool_calling","structured_output"],simulationRequired:true}),
  "cloud-data":Object.freeze({taskType:"cloud-data",complexity:.9,impact:.95,reversibility:.45,risk:"high",requiresTools:true,requiresLongContext:true,externalSideEffects:true,requiredCapabilities:["reasoning","tool_calling","structured_output"],simulationRequired:true}),
  "analytics":Object.freeze({taskType:"analytics",complexity:.75,impact:.65,reversibility:.95,risk:"medium",requiresTools:true,requiresLongContext:true,requiredCapabilities:["reasoning","structured_output","tool_calling"],simulationRequired:true}),
  "liui":Object.freeze({taskType:"adaptive-ui",complexity:.7,impact:.6,reversibility:.95,risk:"medium",requiresVision:true,requiredCapabilities:["reasoning","vision","structured_output"],simulationRequired:false}),
  "device-execution":Object.freeze({taskType:"device-execution",complexity:.95,impact:.95,reversibility:.35,risk:"high",requiresTools:true,externalSideEffects:true,requiredCapabilities:["reasoning","tool_calling","structured_output"],simulationRequired:true}),
});

const CAPABILITY_SURFACE=Object.freeze({
  "multilingual-chat":"general-assistant",
  "advanced-reasoning":"general-assistant",
  "app-website-builder":"app-builder",
  "coding-agent":"app-builder",
  "visual-understanding":"ai-image",
  "local-image-creation":"ai-image",
  "premium-image-studio":"ai-image",
  "browser-voice":"voice",
  "cloud-transcription":"voice",
  "premium-neural-voice":"voice",
  "video-storyboard":"ai-video",
  "premium-video-studio":"ai-video",
  "project-memory":"memory",
  "live-web-research":"research-browser",
  "document-workspace":"documents",
  "scheduled-work":"automations",
  "connected-actions":"connectors",
});

export const LANERIQ_SYSTEM_SURFACES=Object.freeze(["communications","cloud-data","analytics","liui","device-execution"]);

function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}
function text(value,max=1200){return String(value??"").trim().slice(0,max);}
function profileFor(surface){const profile=SURFACE_PROFILES[surface];if(!profile)throw new Error(`LANERIQ_PRODUCT_INTELLIGENCE_SURFACE_UNSUPPORTED:${surface}`);return profile;}

export function getCapabilitySurface(capabilityId){
  const id=text(capabilityId,120);
  const surface=CAPABILITY_SURFACE[id];
  if(!surface)throw new Error(`LANERIQ_CAPABILITY_INTELLIGENCE_MAPPING_MISSING:${id||"empty"}`);
  return surface;
}

export function createCapabilityCognitiveRun(capabilityId,input={}){
  const capability=SOOLEN_CAPABILITIES.find(item=>item.id===capabilityId);
  if(!capability)throw new Error(`LANERIQ_CAPABILITY_UNKNOWN:${capabilityId||"empty"}`);
  const surface=getCapabilitySurface(capability.id);
  const profile=profileFor(surface);
  const goal=text(input.goal||`${capability.name}: ${capability.description}`);
  const run=createCognitiveRun({...profile,...input,goal,taskType:input.taskType||profile.taskType,uncertainty:input.uncertainty||{evidenceCoverage:.55,sourceAgreement:.65,testCoverage:.35,evidenceClass:EVIDENCE_CLASSES.INTERNAL,externalVerificationRequired:false}});
  const highRisk=["high","critical"].includes(String(profile.risk).toLowerCase())||profile.externalSideEffects===true||input.externalSideEffects===true||input.production===true||input.destructive===true||input.financial===true;
  return freeze({
    coverageVersion:LANERIQ_PRODUCT_INTELLIGENCE_COVERAGE_VERSION,
    capability:Object.freeze({id:capability.id,name:capability.name,category:capability.category}),
    surface,
    cognitive:run,
    constitution:Object.freeze({lawName:LAW.name,lawVersion:LAW.version,lawDigest:LAW.lawDigest,applies:true,humanCriticalVetoPreserved:true,benefitClaimMayExpandAuthority:false}),
    executionBoundary:Object.freeze({constitutionalExecutionTokenRequired:highRisk,leastPrivilegeRequired:true,userAuthorizedScopeOnly:true,externalSideEffectsRequireExplicitAuthorization:profile.externalSideEffects===true||input.externalSideEffects===true,productionReleaseControlAuthoritative:true}),
    truthBoundary:Object.freeze({coverageIsCodeArchitectureNotLiveProviderProof:true,productionVerified:false}),
  });
}

export function createSystemSurfaceCognitiveRun(surface,input={}){
  if(!LANERIQ_SYSTEM_SURFACES.includes(surface))throw new Error(`LANERIQ_SYSTEM_SURFACE_UNKNOWN:${surface||"empty"}`);
  const profile=profileFor(surface);
  const goal=text(input.goal||`Operate LANERIQ ${surface} safely`);
  const run=createCognitiveRun({...profile,...input,goal,taskType:input.taskType||profile.taskType,uncertainty:input.uncertainty||{evidenceCoverage:.55,sourceAgreement:.65,testCoverage:.35,evidenceClass:EVIDENCE_CLASSES.INTERNAL}});
  return freeze({coverageVersion:LANERIQ_PRODUCT_INTELLIGENCE_COVERAGE_VERSION,surface,cognitive:run,constitution:Object.freeze({lawDigest:LAW.lawDigest,applies:true,humanCriticalVetoPreserved:true}),executionBoundary:Object.freeze({constitutionalExecutionTokenRequired:profile.risk==="high"||profile.externalSideEffects===true,leastPrivilegeRequired:true,productionReleaseControlAuthoritative:true}),truthBoundary:Object.freeze({productionVerified:false})});
}

export function getProductIntelligenceCoverage(){
  const registered=SOOLEN_CAPABILITIES.map(capability=>Object.freeze({capabilityId:capability.id,surface:CAPABILITY_SURFACE[capability.id]||null,covered:Boolean(CAPABILITY_SURFACE[capability.id]),constitutionalLawDigest:LAW.lawDigest}));
  const missing=registered.filter(row=>!row.covered).map(row=>row.capabilityId);
  const system=LANERIQ_SYSTEM_SURFACES.map(surface=>Object.freeze({surface,covered:Boolean(SURFACE_PROFILES[surface]),constitutionalLawDigest:LAW.lawDigest}));
  return freeze({version:LANERIQ_PRODUCT_INTELLIGENCE_COVERAGE_VERSION,registeredCapabilityCount:registered.length,coveredRegisteredCapabilityCount:registered.filter(row=>row.covered).length,allRegisteredCapabilitiesCovered:missing.length===0,missing:Object.freeze(missing),registered:Object.freeze(registered),systemSurfaces:Object.freeze(system),allSystemSurfacesCovered:system.every(row=>row.covered),humanCivilizationLawDigest:LAW.lawDigest,productionVerified:false});
}
