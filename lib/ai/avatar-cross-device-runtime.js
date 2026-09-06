const SAFE_KEYS=new Set(["persona","language","voiceStyle","motionProfile","visualStyle","outfitId","relationshipState","lastState"]);
function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function boundedObject(value,maxKeys=24){if(!value||typeof value!=="object"||Array.isArray(value))return{};const out={};for(const [k,v] of Object.entries(value).slice(0,maxKeys)){if(SAFE_KEYS.has(k))out[k]=typeof v==="string"?clean(v,160):v;}return out;}

export function buildCharacterContinuitySnapshot({manifest,runtimeState={},deviceClass="unknown",revision=0,updatedAtMs=Date.now(),persistentMemoryOptIn=false,preferences={}}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  return{
    contract:"laneriq-character-continuity-v1",
    characterId:manifest.characterId,
    continuityKey:clean(manifest?.dna?.continuity?.key,96),
    revision:Math.max(0,Math.floor(Number(revision)||0)),
    updatedAtMs:Math.max(0,Math.floor(Number(updatedAtMs)||0)),
    deviceClass:clean(deviceClass,40)||"unknown",
    state:{
      persona:manifest?.dna?.persona||"warm",
      language:manifest?.dna?.language||"en",
      voiceStyle:manifest?.dna?.voice?.style||"natural",
      motionProfile:manifest?.dna?.motion?.profile||"natural",
      visualStyle:manifest?.dna?.visualStyle||"cinematic",
      lastState:clean(runtimeState?.state,24)||"idle",
      ...boundedObject(preferences)
    },
    privacy:{ownerScoped:true,persistentMemoryIncluded:false,persistentMemoryOptIn:Boolean(persistentMemoryOptIn),rawAssetIncluded:false}
  };
}

export function mergeCharacterContinuitySnapshots(localSnapshot,remoteSnapshot,{prefer="newer"}={}){
  if(!localSnapshot?.characterId)return remoteSnapshot;if(!remoteSnapshot?.characterId)return localSnapshot;
  if(localSnapshot.characterId!==remoteSnapshot.characterId)throw new Error("CHARACTER_CONTINUITY_MISMATCH");
  const localRev=Number(localSnapshot.revision)||0,remoteRev=Number(remoteSnapshot.revision)||0;
  let winner;if(localRev!==remoteRev)winner=localRev>remoteRev?localSnapshot:remoteSnapshot;
  else{const lt=Number(localSnapshot.updatedAtMs)||0,rt=Number(remoteSnapshot.updatedAtMs)||0;winner=lt===rt?(prefer==="local"?localSnapshot:remoteSnapshot):(lt>rt?localSnapshot:remoteSnapshot);}
  return{...winner,state:boundedObject(winner.state),privacy:{ownerScoped:true,persistentMemoryIncluded:false,persistentMemoryOptIn:Boolean(winner?.privacy?.persistentMemoryOptIn),rawAssetIncluded:false},mergedFrom:{localRevision:localRev,remoteRevision:remoteRev}};
}

export function buildCharacterDeviceHandoff({snapshot,targetDeviceClass="unknown",expiresInMs=300000}={}){
  if(!snapshot?.characterId)throw new Error("CHARACTER_CONTINUITY_SNAPSHOT_REQUIRED");
  const ttl=Math.max(30000,Math.min(600000,Number(expiresInMs)||300000));
  return{contract:"laneriq-character-handoff-v1",characterId:snapshot.characterId,revision:snapshot.revision||0,targetDeviceClass:clean(targetDeviceClass,40)||"unknown",continuity:snapshot.state,privacy:snapshot.privacy,expiresInMs:ttl,transport:"encrypted-owner-session-only"};
}

export function validateCharacterHandoff(handoff,{characterId,ageMs=0}={}){
  if(!handoff||handoff.contract!=="laneriq-character-handoff-v1")return{valid:false,reason:"INVALID_HANDOFF"};
  if(characterId&&handoff.characterId!==characterId)return{valid:false,reason:"CHARACTER_MISMATCH"};
  if(Number(ageMs)>Number(handoff.expiresInMs||0))return{valid:false,reason:"HANDOFF_EXPIRED"};
  if(handoff.transport!=="encrypted-owner-session-only")return{valid:false,reason:"UNSAFE_TRANSPORT"};
  return{valid:true,reason:"OK"};
}
