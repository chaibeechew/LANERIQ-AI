import {canTransitionCharacter} from "./avatar-character-core.js";

export const AVATAR_RUNTIME_EVENTS=Object.freeze({
  USER_SPEECH_START:"listening",
  USER_SPEECH_END:"thinking",
  AI_THINKING:"thinking",
  AI_RESPONSE_START:"speaking",
  AI_RESPONSE_END:"idle",
  ACTION_START:"acting",
  ACTION_SUCCESS:"success",
  ACTION_ERROR:"concerned",
  RESET:"idle"
});

const EMOTIONS=new Set(["neutral","warm","focused","excited","concerned"]);
const THERMAL_ORDER={nominal:0,fair:1,serious:2,critical:3};
const VISEMES=new Set(["sil","aa","ee","ih","oh","ou","fv","l","mbp","th","wq","ch","r","sz","kg"]);

function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function emotion(value,fallback="neutral"){const v=String(value||"").toLowerCase();return EMOTIONS.has(v)?v:fallback;}

export function createAvatarRuntimeState(manifest,{profile}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const selected=profile&&manifest?.runtime?.profiles?.[profile]?profile:manifest?.runtime?.defaultProfile||"balanced";
  return{
    characterId:manifest.characterId,
    state:manifest?.behavior?.initialState||"idle",
    emotion:"neutral",
    profile:selected,
    speaking:false,
    listening:false,
    acting:false,
    sequence:0,
    lastEvent:"INIT",
    rejectedEvent:null
  };
}

export function reduceAvatarRuntime(state,event,{emotion:nextEmotion}={}){
  if(!state?.characterId)throw new Error("AVATAR_RUNTIME_STATE_REQUIRED");
  const eventName=String(event||"").toUpperCase();
  const target=AVATAR_RUNTIME_EVENTS[eventName];
  if(!target)return{...state,rejectedEvent:eventName||"UNKNOWN",sequence:(state.sequence||0)+1};
  const allowed=target===state.state||target==="idle"||canTransitionCharacter(state.state,target);
  if(!allowed)return{...state,rejectedEvent:eventName,sequence:(state.sequence||0)+1,lastEvent:eventName};
  const stateEmotion=nextEmotion?emotion(nextEmotion,state.emotion):target==="concerned"?"concerned":target==="thinking"?"focused":target==="success"?"excited":state.emotion||"neutral";
  return{
    ...state,
    state:target,
    emotion:stateEmotion,
    speaking:target==="speaking",
    listening:target==="listening",
    acting:target==="acting",
    sequence:(state.sequence||0)+1,
    lastEvent:eventName,
    rejectedEvent:null
  };
}

export function selectAvatarPerformanceProfile({thermalState="nominal",batteryLevel=1,lowPowerMode=false,reducedMotion=false,background=false,deviceTier="mid"}={}){
  const thermal=THERMAL_ORDER[String(thermalState||"").toLowerCase()]??THERMAL_ORDER.nominal;
  const battery=clamp(batteryLevel,0,1);
  if(background||lowPowerMode||reducedMotion||thermal>=THERMAL_ORDER.serious||battery<0.2)return"eco";
  if(String(deviceTier).toLowerCase()==="high"&&thermal===THERMAL_ORDER.nominal&&battery>=0.5)return"performance";
  return"balanced";
}

export function normalizeVisemeTimeline(entries,{durationMs=15000,maxEntries=240}={}){
  const duration=clamp(durationMs,1,15000);
  const limit=Math.max(1,Math.min(240,Number(maxEntries)||240));
  const result=[];
  for(const entry of Array.isArray(entries)?entries.slice(0,limit):[]){
    const id=String(entry?.viseme||entry?.id||"sil").toLowerCase();
    result.push({
      atMs:Math.round(clamp(entry?.atMs,0,duration)),
      viseme:VISEMES.has(id)?id:"sil",
      weight:clamp(entry?.weight??1,0,1)
    });
  }
  return result.sort((a,b)=>a.atMs-b.atMs);
}

export function buildAvatarFaceFrame({state="idle",emotion:inputEmotion="neutral",viseme="sil",visemeWeight=0,gazeX=0,gazeY=0,blink=0,headYaw=0,headPitch=0,headRoll=0,breath=0.25}={}){
  const e=emotion(inputEmotion);
  const v=VISEMES.has(String(viseme).toLowerCase())?String(viseme).toLowerCase():"sil";
  const smile=e==="warm"?0.35:e==="excited"?0.62:state==="success"?0.5:0;
  const frown=e==="concerned"||state==="concerned"?0.42:0;
  const browUp=e==="excited"?0.34:state==="listening"?0.18:0;
  const browDown=e==="focused"||state==="thinking"?0.22:0;
  return{
    state,
    emotion:e,
    viseme:v,
    channels:{
      "blink-left":clamp(blink,0,1),"blink-right":clamp(blink,0,1),
      "jaw-open":v==="sil"?0:clamp(visemeWeight,0,1)*0.7,
      "mouth-smile":smile,"mouth-frown":frown,
      "brow-up":browUp,"brow-down":browDown,
      "eye-look-x":clamp(gazeX,-1,1),"eye-look-y":clamp(gazeY,-1,1),
      "head-yaw":clamp(headYaw,-1,1),"head-pitch":clamp(headPitch,-1,1),"head-roll":clamp(headRoll,-1,1),
      breath:clamp(breath,0,1)
    }
  };
}
