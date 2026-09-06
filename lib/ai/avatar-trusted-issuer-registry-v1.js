const SHA256=/^[a-f0-9]{64}$/;
const TRUST_LEVELS=new Set(["test","verified","production"]);
const ISSUER_TYPES=new Set(["github-ci","vercel-preview","native-host","provider-verifier","device-lab","secure-hardware","production-runtime","release-controller"]);
function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function uniq(v,max=16){return [...new Set((Array.isArray(v)?v:[]).slice(0,max).map(x=>clean(x,64).toLowerCase()).filter(Boolean))];}

export const AVATAR_TRUSTED_ISSUER_REGISTRY_V1="laneriq-avatar-trusted-issuer-registry-v1";

export function createAvatarTrustedIssuerRegistry({registryId="avatar-live-issuers",revision=1,createdAtMs=Date.now()}={}){
  return{contract:AVATAR_TRUSTED_ISSUER_REGISTRY_V1,registryId:clean(registryId,96)||"avatar-live-issuers",revision:Math.max(1,Math.floor(Number(revision)||1)),createdAtMs:Number(createdAtMs)||Date.now(),issuers:[],revocations:[],immutableHistory:true,defaultDeny:true};
}

export function registerAvatarTrustedIssuer(registry,{issuerId,issuerType,trustLevel="verified",keyId,keyFingerprint,allowedSources=[],allowedCapabilities=[],validFromMs=Date.now(),validUntilMs=0}={}){
  if(registry?.contract!==AVATAR_TRUSTED_ISSUER_REGISTRY_V1)throw new Error("AVATAR_ISSUER_REGISTRY_REQUIRED");const id=clean(issuerId,120),type=clean(issuerType,40).toLowerCase(),trust=clean(trustLevel,24).toLowerCase(),kid=clean(keyId,120),fingerprint=clean(keyFingerprint,64).toLowerCase();if(!id||!ISSUER_TYPES.has(type)||!TRUST_LEVELS.has(trust)||!kid||!SHA256.test(fingerprint))throw new Error("AVATAR_TRUSTED_ISSUER_CONTEXT_INVALID");if((registry.issuers||[]).some(x=>x.issuerId===id&&x.keyId===kid&&x.status!=="revoked"))throw new Error("AVATAR_TRUSTED_ISSUER_DUPLICATE");const from=Math.max(0,Number(validFromMs)||0),until=Math.max(0,Number(validUntilMs)||0);if(until&&until<=from)throw new Error("AVATAR_TRUSTED_ISSUER_VALIDITY_INVALID");const entry={issuerId:id,issuerType:type,trustLevel:trust,keyId:kid,keyFingerprint:fingerprint,allowedSources:uniq(allowedSources),allowedCapabilities:uniq(allowedCapabilities),validFromMs:from,validUntilMs:until,status:"active",registeredRevision:(registry.revision||1)+1};return{...registry,revision:(registry.revision||1)+1,issuers:[...(registry.issuers||[]),entry]};
}

export function revokeAvatarTrustedIssuer(registry,{issuerId,keyId,reason="revoked",atMs=Date.now()}={}){
  if(registry?.contract!==AVATAR_TRUSTED_ISSUER_REGISTRY_V1)throw new Error("AVATAR_ISSUER_REGISTRY_REQUIRED");const id=clean(issuerId,120),kid=clean(keyId,120),found=(registry.issuers||[]).find(x=>x.issuerId===id&&x.keyId===kid&&x.status!=="revoked");if(!found)throw new Error("AVATAR_TRUSTED_ISSUER_NOT_FOUND");const at=Number(atMs)||Date.now(),revocation={issuerId:id,keyId:kid,reason:clean(reason,120)||"revoked",atMs:at,revision:(registry.revision||1)+1};return{...registry,revision:(registry.revision||1)+1,issuers:(registry.issuers||[]).map(x=>x===found?{...x,status:"revoked",revokedAtMs:at}:x),revocations:[...(registry.revocations||[]),revocation]};
}

export function evaluateAvatarTrustedIssuer(registry,{issuerId,keyId,keyFingerprint,sourceType,capability,nowMs=Date.now(),minimumTrust="verified"}={}){
  const reasons=[];if(registry?.contract!==AVATAR_TRUSTED_ISSUER_REGISTRY_V1)reasons.push("ISSUER_REGISTRY_INVALID");const id=clean(issuerId,120),kid=clean(keyId,120),fingerprint=clean(keyFingerprint,64).toLowerCase(),now=Number(nowMs)||Date.now(),entry=(registry?.issuers||[]).find(x=>x.issuerId===id&&x.keyId===kid);if(!entry)reasons.push("ISSUER_NOT_REGISTERED");else{if(entry.status!=="active")reasons.push("ISSUER_REVOKED");if(entry.keyFingerprint!==fingerprint)reasons.push("ISSUER_KEY_FINGERPRINT_MISMATCH");if(now<entry.validFromMs)reasons.push("ISSUER_KEY_NOT_YET_VALID");if(entry.validUntilMs&&now>=entry.validUntilMs)reasons.push("ISSUER_KEY_EXPIRED");if(entry.allowedSources.length&&!entry.allowedSources.includes(clean(sourceType,64).toLowerCase()))reasons.push("ISSUER_SOURCE_NOT_ALLOWED");if(entry.allowedCapabilities.length&&!entry.allowedCapabilities.includes(clean(capability,64).toLowerCase()))reasons.push("ISSUER_CAPABILITY_NOT_ALLOWED");const rank={test:0,verified:1,production:2};if((rank[entry.trustLevel]??-1)<(rank[minimumTrust]??1))reasons.push("ISSUER_TRUST_LEVEL_LOW");}return{contract:"laneriq-avatar-trusted-issuer-evaluation-v1",pass:reasons.length===0,reasons,issuerId:id,keyId:kid,trustLevel:entry?.trustLevel||"none",issuerType:entry?.issuerType||"unknown",registryRevision:Number(registry?.revision)||0};
}

export function getAvatarTrustedIssuerRegistryReadiness(){return{contract:AVATAR_TRUSTED_ISSUER_REGISTRY_V1,defaultDeny:true,keyFingerprintBinding:true,keyRotationViaNewKeyId:true,revocation:true,scopeRestriction:true,trustLevels:true,codeReady:true,externalPKIVerifierLive:false};}
