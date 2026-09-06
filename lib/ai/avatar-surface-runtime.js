function clamp(v,min,max){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function clean(v,max=80){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function createAvatarSurfaceRuntime({characterId,renderer="2.5d",targetFps=30,renderScale=1}={}){
  const id=clean(characterId,96);if(!id)throw new Error("CHARACTER_ID_REQUIRED");
  return{contract:"laneriq-avatar-surface-runtime-v1",characterId:id,renderer:["2.5d","lightweight-3d","3d"].includes(renderer)?renderer:"2.5d",targetFps:clamp(targetFps,12,60),renderScale:clamp(renderScale,.5,1),lastFrameAt:0,droppedFrames:0,renderedFrames:0,emaFrameMs:1000/clamp(targetFps,12,60),qualityPressure:0};
}

export function buildAvatar2_5DSurfaceFrame({renderPacket,bodyCommand,faceCommand}={}){
  if(!renderPacket?.characterId)throw new Error("AVATAR_RENDER_PACKET_REQUIRED");
  const joints=bodyCommand?.joints||{},channels=faceCommand?.channels||[];
  const channelMap=Object.fromEntries(channels.map(item=>[item.name,item.value]));
  const yaw=clamp(channelMap["head-yaw"]||0,-1,1),pitch=clamp(channelMap["head-pitch"]||0,-1,1),roll=clamp(channelMap["head-roll"]||0,-1,1);
  return{
    contract:"laneriq-avatar-2.5d-frame-v1",
    characterId:renderPacket.characterId,
    timestampMs:renderPacket.timestampMs||0,
    transform:{translateX:`${(joints.rootX||0)*10}px`,translateY:`${(joints.rootY||0)*12}px`,rotate:`${(roll*3+(joints.spineYaw||0)*2).toFixed(2)}deg`,scale:(1+(joints.weightShift||0)*.02).toFixed(4)},
    portrait:{rotateX:`${(-pitch*4).toFixed(2)}deg`,rotateY:`${(yaw*6).toFixed(2)}deg`,mouthOpen:clamp(channelMap["jaw-open"]||0,0,1),blink:clamp(Math.max(channelMap["blink-left"]||0,channelMap["blink-right"]||0),0,1),smile:clamp(channelMap["mouth-smile"]||0,0,1)},
    gesture:bodyCommand?.gesture||renderPacket.semanticMotion||"idle-balanced",
    effects:renderPacket.effects||{},
    accessibility:{decorativeMotion:true,reducedMotionFallback:"static-expression-state"}
  };
}

export function recordAvatarSurfaceFrame(runtime,{frameDurationMs,rendered=true}={}){
  if(!runtime?.characterId)throw new Error("AVATAR_SURFACE_RUNTIME_REQUIRED");
  const duration=clamp(frameDurationMs,0,250),budget=1000/(runtime.targetFps||30),ema=(runtime.emaFrameMs||budget)*.85+duration*.15;
  const dropped=!rendered||duration>budget*1.5;
  const renderedFrames=(runtime.renderedFrames||0)+(rendered?1:0),droppedFrames=(runtime.droppedFrames||0)+(dropped?1:0),total=Math.max(1,renderedFrames+droppedFrames);
  const dropRate=droppedFrames/total,pressure=clamp(Math.max(ema/budget-1,0)+dropRate*2,0,3);
  return{...runtime,emaFrameMs:ema,renderedFrames,droppedFrames,qualityPressure:pressure};
}

export function recommendAvatarSurfaceDegrade(runtime){
  if(!runtime?.characterId)return{degrade:true,reason:"RUNTIME_REQUIRED",nextRenderer:"2.5d"};
  const pressured=(runtime.qualityPressure||0)>.55||(runtime.emaFrameMs||0)>(1000/(runtime.targetFps||30))*1.35;
  if(!pressured)return{degrade:false,reason:"WITHIN_BUDGET",nextRenderer:runtime.renderer};
  const next=runtime.renderer==="3d"?"lightweight-3d":"2.5d";
  return{degrade:true,reason:"FRAME_BUDGET_PRESSURE",nextRenderer:next};
}

export function buildNativeAvatarRendererAdapterContract({platform="generic"}={}){
  const p=String(platform||"").toLowerCase();
  return{contract:"laneriq-native-avatar-renderer-adapter-v1",platform:["ios","android","desktop"].includes(p)?p:"generic",inputs:["render-packet","face-rig-command","body-rig-command","audio-clock-frame"],requiredEvidence:["real-frame-output","frame-time-benchmark","thermal-benchmark","battery-benchmark"],liveRendererAttached:false};
}
