import {buildAvatarFaceFrame} from "./avatar-runtime-engine.js";

const MOTION_TUNING=Object.freeze({
  subtle:{head:0.22,gaze:0.72,micro:0.45,blinkMin:3200,blinkSpan:2600},
  natural:{head:0.36,gaze:0.86,micro:0.7,blinkMin:2600,blinkSpan:2200},
  expressive:{head:0.52,gaze:1,micro:1,blinkMin:2100,blinkSpan:1800}
});

function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function clean(value,max=96){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function hash32(value){let h=2166136261;for(const ch of String(value||"avatar")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seededUnit(seed,index){let x=(seed+Math.imul(index+1,0x9e3779b1))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return(x>>>0)/4294967295;}
function smooth(current,target,amount){return current+(target-current)*clamp(amount,0,1);}
function motionTuning(profile){return MOTION_TUNING[String(profile||"").toLowerCase()]||MOTION_TUNING.natural;}
function blinkShape(now,start){const elapsed=now-start;if(elapsed<0||elapsed>180)return 0;if(elapsed<=72)return Math.sin((elapsed/72)*(Math.PI/2));return Math.cos(((elapsed-72)/108)*(Math.PI/2));}
function nextBlinkAt(seed,index,base,tuning){return base+tuning.blinkMin+Math.round(seededUnit(seed,index)*tuning.blinkSpan);}
function stateHeadBias(state){return state==="listening"?{yaw:.02,pitch:-.03}:state==="thinking"?{yaw:.06,pitch:.04}:state==="speaking"?{yaw:-.02,pitch:-.01}:state==="concerned"?{yaw:.03,pitch:.06}:{yaw:0,pitch:0};}

export function createAvatarFaceRuntime(manifest,{nowMs=0,reducedMotion=false}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const seed=hash32(manifest.characterId);
  const tuning=motionTuning(manifest?.dna?.motion?.profile);
  const now=Math.max(0,Number(nowMs)||0);
  return{
    characterId:manifest.characterId,
    motionProfile:manifest?.dna?.motion?.profile||"natural",
    reducedMotion:Boolean(reducedMotion),
    seed,
    blinkIndex:0,
    nextBlinkAt:nextBlinkAt(seed,0,now,tuning),
    lastNowMs:now,
    gaze:{x:0,y:0},
    head:{yaw:0,pitch:0,roll:0},
    microSequence:0,
    frame:buildAvatarFaceFrame()
  };
}

export function normalizeAttentionTarget(target={}){
  return{
    x:clamp(target?.x,-1,1),
    y:clamp(target?.y,-1,1),
    confidence:clamp(target?.confidence??1,0,1),
    kind:["user","content","action","ambient"].includes(String(target?.kind||""))?String(target.kind):"user"
  };
}

export function advanceAvatarFaceRuntime(runtime,{nowMs,behaviorState="idle",emotion="neutral",viseme="sil",visemeWeight=0,attentionTarget,reducedMotion}={}){
  if(!runtime?.characterId)throw new Error("AVATAR_FACE_RUNTIME_REQUIRED");
  const now=Math.max(runtime.lastNowMs||0,Number(nowMs)||0);
  const dt=Math.min(80,Math.max(0,now-(runtime.lastNowMs||now)));
  const tuning=motionTuning(runtime.motionProfile);
  const reduced=typeof reducedMotion==="boolean"?reducedMotion:Boolean(runtime.reducedMotion);
  let blinkIndex=runtime.blinkIndex||0;
  let scheduled=runtime.nextBlinkAt||nextBlinkAt(runtime.seed,blinkIndex,now,tuning);
  const blink=blinkShape(now,scheduled);
  if(now>scheduled+180){blinkIndex+=1;scheduled=nextBlinkAt(runtime.seed,blinkIndex,scheduled+180,tuning);}

  const target=normalizeAttentionTarget(attentionTarget||{});
  const confidence=target.confidence;
  const gazeStrength=reduced?0.25:tuning.gaze;
  const saccadeIndex=Math.floor(now/900);
  const saccadeX=(seededUnit(runtime.seed,saccadeIndex)-.5)*.08*(reduced?0:tuning.micro);
  const saccadeY=(seededUnit(runtime.seed+17,saccadeIndex)-.5)*.05*(reduced?0:tuning.micro);
  const desiredGazeX=clamp(target.x*confidence*gazeStrength+saccadeX,-1,1);
  const desiredGazeY=clamp(target.y*confidence*gazeStrength+saccadeY,-1,1);
  const response=1-Math.exp(-(dt||16)/(reduced?180:95));
  const gaze={x:smooth(runtime.gaze?.x||0,desiredGazeX,response),y:smooth(runtime.gaze?.y||0,desiredGazeY,response)};

  const bias=stateHeadBias(behaviorState);
  const microIndex=Math.floor(now/1600);
  const microYaw=(seededUnit(runtime.seed+31,microIndex)-.5)*.12*(reduced?0:tuning.micro);
  const microPitch=(seededUnit(runtime.seed+47,microIndex)-.5)*.08*(reduced?0:tuning.micro);
  const desiredHead={
    yaw:clamp((gaze.x*.28+bias.yaw+microYaw)*tuning.head,-1,1),
    pitch:clamp((gaze.y*.18+bias.pitch+microPitch)*tuning.head,-1,1),
    roll:clamp((behaviorState==="listening"?0.045:0)*(reduced?0.25:tuning.head),-1,1)
  };
  const head={
    yaw:smooth(runtime.head?.yaw||0,desiredHead.yaw,response*.55),
    pitch:smooth(runtime.head?.pitch||0,desiredHead.pitch,response*.55),
    roll:smooth(runtime.head?.roll||0,desiredHead.roll,response*.45)
  };
  const breath=reduced?0.12:0.22+Math.sin(now/1350)*.06;
  const frame=buildAvatarFaceFrame({state:behaviorState,emotion,viseme,visemeWeight,gazeX:gaze.x,gazeY:gaze.y,blink,headYaw:head.yaw,headPitch:head.pitch,headRoll:head.roll,breath});
  return{
    ...runtime,
    reducedMotion:reduced,
    blinkIndex,
    nextBlinkAt:scheduled,
    lastNowMs:now,
    gaze,
    head,
    microSequence:microIndex,
    frame
  };
}

export function buildFaceRigCommand(frame,{maxChannels=52}={}){
  const limit=Math.max(1,Math.min(52,Number(maxChannels)||52));
  const channels=Object.entries(frame?.channels||{})
    .map(([name,value])=>({name:clean(name,48),value:clamp(value,-1,1)}))
    .filter(item=>item.name)
    .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))
    .slice(0,limit);
  return{
    contract:"blendshape-v1",
    state:clean(frame?.state,24)||"idle",
    emotion:clean(frame?.emotion,24)||"neutral",
    viseme:clean(frame?.viseme,16)||"sil",
    channels
  };
}
