import {createAvatarCharacterDataAdapter} from "../cloud-adapters/avatar-character-data.js";

const CHARACTER_ID=/^[A-Za-z0-9._:-]{1,96}$/;
const DEVICE_HASH=/^[a-f0-9]{64}$/;
function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function fail(code,detail=null,extra={}){return Object.freeze({ok:false,code,detail,...extra});}
function getAdapter(){return createAvatarCharacterDataAdapter();}
function manifestOk(manifest,characterId){if(!manifest||typeof manifest!=="object"||Array.isArray(manifest))return false;if(manifest.schema!=="laneriq.living-character"||manifest.characterId!==characterId)return false;const version=Number(manifest.schemaVersion);return Number.isInteger(version)&&version>=2&&version<=4&&Buffer.byteLength(JSON.stringify(manifest),"utf8")<=32768;}
function snapshotOk(snapshot,characterId){if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return false;if(snapshot.contract!=="laneriq-character-continuity-v1"||snapshot.characterId!==characterId)return false;if(snapshot?.privacy?.persistentMemoryIncluded===true||snapshot?.privacy?.rawAssetIncluded===true)return false;return Buffer.byteLength(JSON.stringify(snapshot),"utf8")<=16384;}

export async function loadAvatarCharacter({characterId}){
  const id=clean(characterId,96);if(!CHARACTER_ID.test(id))return fail("CHARACTER_ID_INVALID");const result=await getAdapter().loadCharacter({characterId:id});if(!result?.ok)return fail(result?.code||"CHARACTER_LOAD_FAILED",result?.detail||null,{revision:result?.revision});return Object.freeze({ok:true,row:result.row});
}

export async function saveAvatarCharacter({characterId,manifest,expectedRevision=null,persistentMemoryOptIn=false,memoryBindingId=null}){
  const id=clean(characterId,96);if(!CHARACTER_ID.test(id))return fail("CHARACTER_ID_INVALID");if(!manifestOk(manifest,id))return fail("CHARACTER_MANIFEST_INVALID");const binding=clean(memoryBindingId,160)||null;
  const result=await getAdapter().saveCharacter({characterId:id,manifest,expectedRevision:Number.isInteger(expectedRevision)&&expectedRevision>=0?expectedRevision:null,persistentMemoryOptIn:Boolean(persistentMemoryOptIn),memoryBindingId:binding});if(!result?.ok)return fail(result?.code||"CHARACTER_SAVE_FAILED",result?.detail||null,{revision:result?.revision});return Object.freeze({ok:true,row:result.row,created:Boolean(result.created)});
}

export async function loadAvatarContinuity({characterId}){
  const id=clean(characterId,96);if(!CHARACTER_ID.test(id))return fail("CHARACTER_ID_INVALID");const result=await getAdapter().listContinuity({characterId:id});if(!result?.ok)return fail(result?.code||"CHARACTER_CONTINUITY_LOAD_FAILED",result?.detail||null);return Object.freeze({ok:true,rows:result.rows||[]});
}

export async function saveAvatarContinuity({characterId,deviceIdHash,deviceClass="unknown",snapshot}){
  const id=clean(characterId,96),deviceHash=clean(deviceIdHash,64).toLowerCase(),device=clean(deviceClass,40)||"unknown";if(!CHARACTER_ID.test(id)||!DEVICE_HASH.test(deviceHash))return fail("CHARACTER_CONTINUITY_ID_INVALID");if(!snapshotOk(snapshot,id))return fail("CHARACTER_CONTINUITY_SNAPSHOT_INVALID");const revision=Math.max(0,Math.floor(Number(snapshot.revision)||0));
  const result=await getAdapter().saveContinuity({characterId:id,deviceIdHash:deviceHash,deviceClass:device,snapshot,revision});if(!result?.ok)return fail(result?.code||"CHARACTER_CONTINUITY_SAVE_FAILED",result?.detail||null);return Object.freeze({ok:true,row:result.row});
}
