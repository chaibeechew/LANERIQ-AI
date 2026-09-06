const SHA=/^[a-f0-9]{40}$/;
function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
export const AVATAR_LIVE_LEASE_V1="laneriq-avatar-live-lease-v1";

export function issueAvatarLiveLease({capability,headSha,releaseId,evidenceBundleId,approvedBy,issuedAtMs=Date.now(),ttlMs=24*60*60*1000}={}){
  const sha=clean(headSha,40).toLowerCase(),issued=Number(issuedAtMs)||Date.now(),ttl=Math.min(7*24*60*60*1000,Math.max(5*60*1000,Number(ttlMs)||24*60*60*1000));if(!clean(capability,64)||!SHA.test(sha)||!clean(releaseId,120)||!clean(evidenceBundleId,160)||!clean(approvedBy,120))throw new Error("AVATAR_LIVE_LEASE_CONTEXT_INVALID");return{contract:AVATAR_LIVE_LEASE_V1,leaseId:`lease:${clean(capability,48)}:${sha.slice(0,12)}:${issued}`,capability:clean(capability,64),headSha:sha,releaseId:clean(releaseId,120),evidenceBundleId:clean(evidenceBundleId,160),approvedBy:clean(approvedBy,120),issuedAtMs:issued,expiresAtMs:issued+ttl,status:"active",renewable:true,autoRenew:false,automaticManifestMutation:false};
}

export function evaluateAvatarLiveLease(lease,{expectedHeadSha,nowMs=Date.now(),activeIncidents=[]}={}){
  const reasons=[];if(lease?.contract!==AVATAR_LIVE_LEASE_V1)reasons.push("LIVE_LEASE_INVALID");const expected=clean(expectedHeadSha,40).toLowerCase(),now=Number(nowMs)||Date.now();if(!SHA.test(expected)||lease?.headSha!==expected)reasons.push("LIVE_LEASE_SHA_MISMATCH");if(lease?.status!=="active")reasons.push("LIVE_LEASE_NOT_ACTIVE");if(Number(lease?.expiresAtMs)<=now)reasons.push("LIVE_LEASE_EXPIRED");if((activeIncidents||[]).some(x=>x?.capability===lease?.capability&&x?.status!=="resolved"))reasons.push("LIVE_LEASE_INCIDENT_BLOCKED");return{contract:"laneriq-avatar-live-lease-evaluation-v1",pass:reasons.length===0,reasons,expiresInMs:Math.max(0,Number(lease?.expiresAtMs)-now),requiresRenewal:Number(lease?.expiresAtMs)-now<60*60*1000};
}

export function renewAvatarLiveLease(lease,{evidenceQuorumPass=false,productionProbePass=false,releaseControllerApproval=false,renewedAtMs=Date.now(),ttlMs=24*60*60*1000}={}){
  if(lease?.contract!==AVATAR_LIVE_LEASE_V1)throw new Error("AVATAR_LIVE_LEASE_REQUIRED");if(!evidenceQuorumPass||!productionProbePass||!releaseControllerApproval)throw new Error("AVATAR_LIVE_LEASE_RENEWAL_EVIDENCE_REQUIRED");const at=Number(renewedAtMs)||Date.now(),ttl=Math.min(7*24*60*60*1000,Math.max(5*60*1000,Number(ttlMs)||24*60*60*1000));return{...lease,issuedAtMs:at,expiresAtMs:at+ttl,status:"active",renewalCount:(lease.renewalCount||0)+1,lastRenewalEvidence:{evidenceQuorumPass:true,productionProbePass:true,releaseControllerApproval:true}};
}

export function revokeAvatarLiveLease(lease,{reason="revoked",atMs=Date.now(),authority="production-release-control"}={}){if(lease?.contract!==AVATAR_LIVE_LEASE_V1)throw new Error("AVATAR_LIVE_LEASE_REQUIRED");return{...lease,status:"revoked",revokedAtMs:Number(atMs)||Date.now(),revokedReason:clean(reason,120)||"revoked",revokedBy:clean(authority,120),renewable:false};}

export function getAvatarLiveLeaseReadiness(){return{contract:AVATAR_LIVE_LEASE_V1,expiringCapabilityState:true,maxLeaseDays:7,manualEvidenceRenewal:true,incidentInvalidation:true,shaInvalidation:true,autoRenew:false,codeReady:true,persistentLeaseStoreLive:false};}
