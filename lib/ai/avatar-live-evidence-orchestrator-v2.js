import {evaluateAvatarEvidenceAttestation} from "./avatar-evidence-attestation-v2.js";
function clean(v,max=120){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

const POLICIES=Object.freeze({
  realtime3DRenderer:{requiredSources:["native-host","physical-device-lab","github-ci"],requiredClaims:["native-renderer-probe-pass","high-fidelity-asset-ready","frame-budget-pass"],minIssuers:3,minPhysicalModels:2,requiredPlatforms:["ios","android"]},
  liveVoiceProvider:{requiredSources:["provider-probe","physical-device-lab","github-ci"],requiredClaims:["external-neural-voice-pass","exact-phoneme-pass","voice-latency-pass"],minIssuers:3,minPhysicalModels:2,requiredPlatforms:["ios","android"]},
  motionGenerator:{requiredSources:["runtime-probe","physical-device-lab","github-ci"],requiredClaims:["neural-motion-generator-pass","motion-quality-pass","collision-footlock-pass"],minIssuers:3,minPhysicalModels:2,requiredPlatforms:["ios","android"]},
  physicalDeviceBenchmark:{requiredSources:["physical-device-lab","github-ci"],requiredClaims:["device-lab-matrix-pass","ios-coverage","android-coverage","endurance-pass"],minIssuers:2,minPhysicalModels:4,requiredPlatforms:["ios","android"]},
  crossDeviceEncryptedHandoffLive:{requiredSources:["secure-hardware","physical-device-lab","github-ci"],requiredClaims:["hardware-key-custody-pass","cross-device-roundtrip-pass","anti-replay-pass","key-rotation-pass"],minIssuers:3,minPhysicalModels:2,requiredPlatforms:["ios","android"],requireHardware:true}
});

export const AVATAR_LIVE_EVIDENCE_ORCHESTRATOR_V2="laneriq-avatar-live-evidence-orchestrator-v2";
export function getAvatarCapabilityEvidencePolicy(capability){const p=POLICIES[clean(capability,64)];return p?{...p,requiredSources:[...p.requiredSources],requiredClaims:[...p.requiredClaims],requiredPlatforms:[...p.requiredPlatforms]}:null;}

export function evaluateAvatarEvidenceQuorum({capability,attestations=[],expectedHeadSha,nowMs=Date.now()}={}){
  const name=clean(capability,64),policy=POLICIES[name];if(!policy)return{contract:"laneriq-avatar-evidence-quorum-v2",capability:name,pass:false,reasons:["CAPABILITY_POLICY_UNKNOWN"],validAttestations:0};
  const candidates=(Array.isArray(attestations)?attestations:[]).filter(x=>x?.capability===name),valid=[],invalid=[];
  for(const item of candidates){const result=evaluateAvatarEvidenceAttestation(item,{expectedHeadSha,nowMs,requireHardware:policy.requireHardware===true&&item?.sourceType==="secure-hardware",allowedSources:policy.requiredSources});(result.pass?valid:invalid).push({attestation:item,evaluation:result});}
  const sources=new Set(valid.map(x=>x.attestation.sourceType)),issuers=new Set(valid.map(x=>x.attestation.issuer)),claims=new Set(valid.flatMap(x=>x.attestation.claims||[])),physical=valid.filter(x=>x.attestation.physicalDevice===true),models=new Set(physical.map(x=>`${x.attestation.platform}:${x.attestation.model}`).filter(x=>!x.endsWith(":"))),platforms=new Set(physical.map(x=>x.attestation.platform).filter(Boolean)),reasons=[];
  for(const source of policy.requiredSources)if(!sources.has(source))reasons.push(`SOURCE_${source.toUpperCase().replace(/-/g,"_")}_REQUIRED`);
  for(const claim of policy.requiredClaims)if(!claims.has(claim))reasons.push(`CLAIM_${claim.toUpperCase().replace(/-/g,"_")}_REQUIRED`);
  if(issuers.size<policy.minIssuers)reasons.push("INDEPENDENT_ISSUER_QUORUM_LOW");if(models.size<policy.minPhysicalModels)reasons.push("PHYSICAL_MODEL_QUORUM_LOW");for(const platform of policy.requiredPlatforms)if(!platforms.has(platform))reasons.push(`PHYSICAL_PLATFORM_${platform.toUpperCase()}_REQUIRED`);
  return{contract:"laneriq-avatar-evidence-quorum-v2",capability:name,pass:reasons.length===0,reasons,metrics:{candidateCount:candidates.length,validAttestations:valid.length,invalidAttestations:invalid.length,distinctSources:sources.size,distinctIssuers:issuers.size,physicalModels:models.size,platforms:[...platforms],claimsSatisfied:policy.requiredClaims.filter(c=>claims.has(c)).length,claimsRequired:policy.requiredClaims.length},validEvidenceIds:valid.map(x=>x.attestation.evidenceDigest),invalidReasons:invalid.flatMap(x=>x.evaluation.reasons),productionEligible:false,rule:"A capability quorum proves evidence completeness only; Production LIVE still requires exact-main production probe and Release Controller approval."};
}

export function evaluateAllAvatarLiveQuorums({attestations=[],expectedHeadSha,nowMs=Date.now()}={}){const capabilities=Object.keys(POLICIES),quorums={};for(const capability of capabilities)quorums[capability]=evaluateAvatarEvidenceQuorum({capability,attestations,expectedHeadSha,nowMs});return{contract:AVATAR_LIVE_EVIDENCE_ORCHESTRATOR_V2,expectedHeadSha:clean(expectedHeadSha,40).toLowerCase(),quorums,allPassed:capabilities.every(c=>quorums[c].pass),automaticPromotion:false};}

export function getAvatarLiveEvidenceOrchestratorV2Readiness(){return{contract:AVATAR_LIVE_EVIDENCE_ORCHESTRATOR_V2,capabilitySpecificPolicies:true,independentIssuerQuorum:true,physicalModelQuorum:true,platformCoverageGate:true,exactShaFreshnessGate:true,syntheticSelfReportRejected:true,codeReady:true,productionLiveEvidenceCollected:false};}
