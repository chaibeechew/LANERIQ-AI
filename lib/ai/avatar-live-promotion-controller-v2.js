import {evaluateAvatarEvidenceAttestation} from "./avatar-evidence-attestation-v2.js";
function clean(v,max=120){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
const SHA=/^[a-f0-9]{40}$/;
const LIVE_FLAGS=["realtime3DRenderer","liveVoiceProvider","motionGenerator","physicalDeviceBenchmark","crossDeviceEncryptedHandoffLive"];

export const AVATAR_LIVE_PROMOTION_CONTROLLER_V2="laneriq-avatar-live-promotion-controller-v2";

export function validateAvatarReleaseControllerApproval(approval,{expectedHeadSha}={}){
  const reasons=[],sha=clean(expectedHeadSha,40).toLowerCase();if(approval?.contract!=="laneriq-production-release-controller-approval-v1")reasons.push("RELEASE_CONTROLLER_APPROVAL_CONTRACT_INVALID");if(approval?.approved!==true)reasons.push("RELEASE_CONTROLLER_NOT_APPROVED");if(!SHA.test(sha)||clean(approval?.headSha,40).toLowerCase()!==sha)reasons.push("RELEASE_CONTROLLER_SHA_MISMATCH");if(!clean(approval?.approvalId,120)||!clean(approval?.actorId,120))reasons.push("RELEASE_CONTROLLER_IDENTITY_REQUIRED");return{pass:reasons.length===0,reasons};
}

export function buildAvatarLivePromotionDecision({manifest,expectedMainSha,quorums={},productionProbeAttestation,releaseControllerApproval,incidentBlockers=[],nowMs=Date.now()}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");const sha=clean(expectedMainSha,40).toLowerCase(),reasons=[];if(!SHA.test(sha))reasons.push("EXACT_MAIN_SHA_REQUIRED");const probe=evaluateAvatarEvidenceAttestation(productionProbeAttestation,{expectedHeadSha:sha,nowMs,allowedSources:["runtime-probe"]});if(!probe.pass)reasons.push(...probe.reasons.map(x=>`PRODUCTION_PROBE_${x}`));if(!(productionProbeAttestation?.claims||[]).includes("production-runtime-probe-pass"))reasons.push("PRODUCTION_RUNTIME_PROBE_CLAIM_REQUIRED");const approval=validateAvatarReleaseControllerApproval(releaseControllerApproval,{expectedHeadSha:sha});if(!approval.pass)reasons.push(...approval.reasons);const blockers=Array.isArray(incidentBlockers)?incidentBlockers.map(x=>clean(x,120)).filter(Boolean):[];if(blockers.length)reasons.push("ACTIVE_INCIDENT_BLOCKER");
  const requestedLiveFlags={};for(const flag of LIVE_FLAGS){const quorum=quorums?.[flag];requestedLiveFlags[flag]=Boolean(quorum?.contract==="laneriq-avatar-evidence-quorum-v2"&&quorum?.capability===flag&&quorum?.pass===true&&probe.pass&&approval.pass&&blockers.length===0&&SHA.test(sha));}
  return{contract:AVATAR_LIVE_PROMOTION_CONTROLLER_V2,characterId:manifest.characterId,expectedMainSha:sha,pass:reasons.length===0&&Object.values(requestedLiveFlags).some(Boolean),reasons,requestedLiveFlags,productionProbe:{pass:probe.pass,evidenceDigest:productionProbeAttestation?.evidenceDigest||""},releaseApproval:{pass:approval.pass,approvalId:clean(releaseControllerApproval?.approvalId,120),actorId:clean(releaseControllerApproval?.actorId,120)},incidentBlockers:blockers,automaticManifestMutation:false,requiresAtomicReleaseReceipt:true,requiresPostPromotionRuntimeProbe:true,requiresEvidenceFreshnessRecheck:true};
}

export function buildAvatarLiveDowngradePlan({currentLiveFlags={},expiredCapabilities=[],incidentCapabilities=[],wrongSha=false}={}){
  const revoke=new Set([...(Array.isArray(expiredCapabilities)?expiredCapabilities:[]),...(Array.isArray(incidentCapabilities)?incidentCapabilities:[])]);if(wrongSha)for(const flag of LIVE_FLAGS)revoke.add(flag);const next={};for(const flag of LIVE_FLAGS)next[flag]=Boolean(currentLiveFlags?.[flag])&&!revoke.has(flag);return{contract:"laneriq-avatar-live-downgrade-plan-v2",nextLiveFlags:next,revoke:[...revoke].filter(x=>LIVE_FLAGS.includes(x)),automaticProductionMutation:false,requiresReleaseController:true,reasonPriority:wrongSha?"exact-sha-invalid":"evidence-expired-or-incident"};
}

export function getAvatarLivePromotionControllerV2Readiness(){return{contract:AVATAR_LIVE_PROMOTION_CONTROLLER_V2,exactMainGate:true,productionRuntimeProbeGate:true,releaseControllerApprovalGate:true,incidentBlockerGate:true,evidenceExpiryDowngradePlan:true,automaticManifestMutation:false,codeReady:true,productionPromotionLive:false};}
