const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const SOURCE_TYPES=new Set(["github-ci","vercel-preview","native-host","provider-probe","physical-device-lab","secure-hardware","runtime-probe","benchmark"]);
function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function list(v,max=16){return Array.isArray(v)?v.slice(0,max).map(x=>clean(x,120)).filter(Boolean):[];}

export const AVATAR_EVIDENCE_ATTESTATION_V2="laneriq-avatar-evidence-attestation-v2";

export function buildAvatarEvidenceAttestation({capability,headSha,evidenceDigest,issuer,sourceType,probeId,observedAtMs=Date.now(),expiresAtMs,attestationVerified=false,synthetic=false,selfReported=false,physicalDevice=false,platform="",model="",providerFamily="",hardwareBacked=false,exactBuildId="",claims=[]}={}){
  const sha=clean(headSha,40).toLowerCase(),digest=clean(evidenceDigest,64).toLowerCase(),type=clean(sourceType,40).toLowerCase(),observed=Math.max(0,Number(observedAtMs)||0),expires=Math.max(observed+1,Number(expiresAtMs)||observed+24*60*60*1000);
  if(!clean(capability,64)||!SHA.test(sha)||!DIGEST.test(digest)||!clean(issuer,120)||!SOURCE_TYPES.has(type)||!clean(probeId,120))throw new Error("AVATAR_EVIDENCE_ATTESTATION_CONTEXT_INVALID");
  return{contract:AVATAR_EVIDENCE_ATTESTATION_V2,capability:clean(capability,64),headSha:sha,evidenceDigest:digest,issuer:clean(issuer,120),sourceType:type,probeId:clean(probeId,120),observedAtMs:observed,expiresAtMs:expires,attestationVerified:Boolean(attestationVerified),synthetic:Boolean(synthetic),selfReported:Boolean(selfReported),physicalDevice:Boolean(physicalDevice),platform:clean(platform,24).toLowerCase(),model:clean(model,96),providerFamily:clean(providerFamily,80),hardwareBacked:Boolean(hardwareBacked),exactBuildId:clean(exactBuildId,120),claims:list(claims),privacy:{rawPromptIncluded:false,rawMemoryIncluded:false,rawPrivateKeyIncluded:false,rawProviderCredentialIncluded:false}};
}

export function evaluateAvatarEvidenceAttestation(attestation,{expectedHeadSha,nowMs=Date.now(),requirePhysical=false,requireHardware=false,allowedSources=null}={}){
  const reasons=[];if(attestation?.contract!==AVATAR_EVIDENCE_ATTESTATION_V2)reasons.push("ATTESTATION_CONTRACT_INVALID");const expected=clean(expectedHeadSha,40).toLowerCase();if(!SHA.test(expected)||attestation?.headSha!==expected)reasons.push("EXACT_SHA_MISMATCH");if(attestation?.attestationVerified!==true)reasons.push("ATTESTATION_NOT_VERIFIED");if(attestation?.synthetic===true)reasons.push("SYNTHETIC_EVIDENCE_FORBIDDEN");if(attestation?.selfReported===true)reasons.push("SELF_REPORTED_EVIDENCE_FORBIDDEN");const now=Number(nowMs)||Date.now();if(Number(attestation?.observedAtMs)>now+5*60*1000)reasons.push("EVIDENCE_TIME_IN_FUTURE");if(Number(attestation?.expiresAtMs)<=now)reasons.push("EVIDENCE_EXPIRED");if(requirePhysical&&attestation?.physicalDevice!==true)reasons.push("PHYSICAL_DEVICE_ATTESTATION_REQUIRED");if(requireHardware&&attestation?.hardwareBacked!==true)reasons.push("HARDWARE_BACKED_ATTESTATION_REQUIRED");if(Array.isArray(allowedSources)&&allowedSources.length&&!allowedSources.includes(attestation?.sourceType))reasons.push("EVIDENCE_SOURCE_NOT_ALLOWED");return{contract:"laneriq-avatar-evidence-attestation-evaluation-v2",pass:reasons.length===0,reasons,issuer:attestation?.issuer||"",sourceType:attestation?.sourceType||"",fresh:!reasons.includes("EVIDENCE_EXPIRED"),exactSha:!reasons.includes("EXACT_SHA_MISMATCH")};
}

export function getAvatarEvidenceAttestationV2Readiness(){return{contract:AVATAR_EVIDENCE_ATTESTATION_V2,exactShaBinding:true,freshnessGate:true,syntheticRejected:true,selfReportRejected:true,issuerBound:true,privacySafe:true,codeReady:true,cryptographicIssuerVerificationLive:false};}
