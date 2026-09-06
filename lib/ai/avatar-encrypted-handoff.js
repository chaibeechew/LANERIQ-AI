import {decryptPrivateTextEnvelope,encryptPrivateTextEnvelope} from "../cloud/encryption-envelope.js";

function clean(value,max=120){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function safeSnapshot(snapshot){if(!snapshot||snapshot.contract!=="laneriq-character-continuity-v1")throw new Error("AVATAR_CONTINUITY_SNAPSHOT_REQUIRED");if(snapshot?.privacy?.persistentMemoryIncluded===true||snapshot?.privacy?.rawAssetIncluded===true)throw new Error("AVATAR_CONTINUITY_PRIVATE_PAYLOAD_FORBIDDEN");const text=JSON.stringify(snapshot);if(new TextEncoder().encode(text).byteLength>16384)throw new Error("AVATAR_CONTINUITY_SNAPSHOT_TOO_LARGE");return text;}

export async function encryptAvatarDeviceHandoff({snapshot,key,keyId,ownerId,targetDeviceHash}={}){
  const characterId=clean(snapshot?.characterId,96),owner=clean(ownerId,96),device=clean(targetDeviceHash,64).toLowerCase();if(!characterId||!owner||!/^[a-f0-9]{64}$/.test(device))throw new Error("AVATAR_HANDOFF_CONTEXT_REQUIRED");
  const envelope=await encryptPrivateTextEnvelope({plaintext:safeSnapshot(snapshot),key,keyId,context:{tenantId:owner,projectId:characterId,purpose:`avatar-handoff:${device}`}});
  return{contract:"laneriq-avatar-encrypted-handoff-v1",characterId,targetDeviceHash:device,envelope,privacy:{rawAssetIncluded:false,persistentMemoryIncluded:false,keyMaterialIncluded:false},requiresAuthenticatedOwnerSession:true};
}

export async function decryptAvatarDeviceHandoff({handoff,key,ownerId,targetDeviceHash}={}){
  if(handoff?.contract!=="laneriq-avatar-encrypted-handoff-v1")throw new Error("AVATAR_ENCRYPTED_HANDOFF_REQUIRED");const owner=clean(ownerId,96),device=clean(targetDeviceHash,64).toLowerCase();if(device!==handoff.targetDeviceHash)throw new Error("AVATAR_HANDOFF_DEVICE_MISMATCH");
  const plaintext=await decryptPrivateTextEnvelope({envelope:handoff.envelope,key,context:{tenantId:owner,projectId:handoff.characterId,purpose:`avatar-handoff:${device}`}}),snapshot=JSON.parse(plaintext);
  safeSnapshot(snapshot);if(snapshot.characterId!==handoff.characterId)throw new Error("AVATAR_HANDOFF_CHARACTER_MISMATCH");return snapshot;
}

export function getAvatarEncryptedHandoffReadiness(){return{contract:"laneriq-avatar-encrypted-handoff-v1",authenticatedEncryption:true,aadBindsOwnerCharacterTargetDevice:true,keyMaterialInPayload:false,rawAssetsIncluded:false,persistentMemoryIncluded:false,codeReady:true,nativeSecureKeyCustodyLive:false,crossDeviceKeyExchangeLive:false,endToEndHandoffLive:false};}
