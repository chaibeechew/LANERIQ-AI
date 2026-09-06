import {selectAvatarPerformanceProfile} from "./avatar-runtime-engine.js";
import {buildFaceRigCommand} from "./avatar-face-runtime.js";

const RENDERER_BUDGETS=Object.freeze({
  "2.5d":{maxBones:0,maxDrawCalls:24,maxTextureMb:48,lighting:"baked",shadows:false,secondaryMotion:false},
  "lightweight-3d":{maxBones:72,maxDrawCalls:52,maxTextureMb:96,lighting:"single-key",shadows:"contact",secondaryMotion:true},
  "3d":{maxBones:128,maxDrawCalls:90,maxTextureMb:160,lighting:"adaptive",shadows:"soft",secondaryMotion:true}
});

function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function rendererBudget(name){return RENDERER_BUDGETS[name]||RENDERER_BUDGETS["2.5d"];}

export function createAvatarRendererPlan(manifest,{profile,thermalState="nominal",batteryLevel=1,lowPowerMode=false,reducedMotion=false,background=false,deviceTier="mid",viewportWidth=390,viewportHeight=844,devicePixelRatio=2}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const selected=profile&&manifest?.runtime?.profiles?.[profile]?profile:selectAvatarPerformanceProfile({thermalState,batteryLevel,lowPowerMode,reducedMotion,background,deviceTier});
  const runtimeProfile=manifest?.runtime?.profiles?.[selected]||manifest?.runtime?.profiles?.balanced;
  if(!runtimeProfile)throw new Error("AVATAR_RUNTIME_PROFILE_REQUIRED");
  let renderer=runtimeProfile.preferredRenderer||"2.5d";
  if(reducedMotion||background||thermalState==="critical")renderer="2.5d";
  if(renderer==="3d"&&String(deviceTier).toLowerCase()!=="high")renderer="lightweight-3d";
  const base=rendererBudget(renderer);
  const width=Math.round(clamp(viewportWidth,240,4096));
  const height=Math.round(clamp(viewportHeight,240,4096));
  const dpr=clamp(devicePixelRatio,1,3);
  return{
    contract:"laneriq-avatar-renderer-v1",
    characterId:manifest.characterId,
    profile:selected,
    renderer,
    targetFps:runtimeProfile.targetFps,
    renderScale:runtimeProfile.renderScale,
    maxFaceChannels:runtimeProfile.maxFaceChannels,
    viewport:{width,height,devicePixelRatio:dpr,internalWidth:Math.round(width*dpr*runtimeProfile.renderScale),internalHeight:Math.round(height*dpr*runtimeProfile.renderScale)},
    budget:{...base,particles:Boolean(runtimeProfile.particles&&!reducedMotion&&renderer!=="2.5d"),secondaryMotion:Boolean(base.secondaryMotion&&runtimeProfile.secondaryMotion&&!reducedMotion)},
    adaptation:{thermalState:clean(thermalState,20)||"nominal",batteryLevel:clamp(batteryLevel,0,1),lowPowerMode:Boolean(lowPowerMode),reducedMotion:Boolean(reducedMotion),background:Boolean(background),deviceTier:clean(deviceTier,20)||"mid"},
    truthfulCapabilities:{proceduralFace:true,faceRigPacket:true,semanticMotion:true,realtime3DRendererAttached:Boolean(manifest?.readiness?.realtime3DRenderer)}
  };
}

export function buildAvatarRenderPacket({plan,runtimeState,faceFrame,nowMs=0}={}){
  if(!plan?.characterId)throw new Error("AVATAR_RENDERER_PLAN_REQUIRED");
  if(runtimeState?.characterId&&runtimeState.characterId!==plan.characterId)throw new Error("AVATAR_RENDERER_CHARACTER_MISMATCH");
  const state=runtimeState?.state||faceFrame?.state||"idle";
  const semanticMotion={idle:"idle-breathe",listening:"attention-lean",thinking:"thinking-hold",speaking:"speech-support",acting:"action-focus",success:"success-release",concerned:"concern-hold"}[state]||"idle-breathe";
  const face=buildFaceRigCommand(faceFrame||{},{maxChannels:plan.maxFaceChannels});
  const motionIntensity=plan.adaptation?.reducedMotion?0.2:state==="success"?0.85:state==="acting"?0.72:0.5;
  return{contract:plan.contract,characterId:plan.characterId,timestampMs:Math.max(0,Math.round(Number(nowMs)||0)),renderer:plan.renderer,profile:plan.profile,targetFps:plan.targetFps,renderScale:plan.renderScale,state,semanticMotion,face,body:{motion:semanticMotion,secondaryMotion:Boolean(plan.budget?.secondaryMotion),motionIntensity},effects:{particles:Boolean(plan.budget?.particles&&state==="success"),shadows:plan.budget?.shadows,lighting:plan.budget?.lighting},viewport:plan.viewport};
}

export function mergeAvatarRendererSignals(plan,signals={}){
  const adaptation=plan?.adaptation||{};
  return{
    thermalState:Object.prototype.hasOwnProperty.call(signals,"thermalState")?signals.thermalState:adaptation.thermalState||"nominal",
    batteryLevel:Object.prototype.hasOwnProperty.call(signals,"batteryLevel")?signals.batteryLevel:adaptation.batteryLevel??1,
    lowPowerMode:Object.prototype.hasOwnProperty.call(signals,"lowPowerMode")?signals.lowPowerMode:Boolean(adaptation.lowPowerMode),
    reducedMotion:Object.prototype.hasOwnProperty.call(signals,"reducedMotion")?signals.reducedMotion:Boolean(adaptation.reducedMotion),
    background:Object.prototype.hasOwnProperty.call(signals,"background")?signals.background:Boolean(adaptation.background),
    deviceTier:Object.prototype.hasOwnProperty.call(signals,"deviceTier")?signals.deviceTier:adaptation.deviceTier||"mid",
    viewportWidth:Object.prototype.hasOwnProperty.call(signals,"viewportWidth")?signals.viewportWidth:plan?.viewport?.width||390,
    viewportHeight:Object.prototype.hasOwnProperty.call(signals,"viewportHeight")?signals.viewportHeight:plan?.viewport?.height||844,
    devicePixelRatio:Object.prototype.hasOwnProperty.call(signals,"devicePixelRatio")?signals.devicePixelRatio:plan?.viewport?.devicePixelRatio||2
  };
}

export function shouldReplanAvatarRenderer(plan,signals={}){
  if(!plan)return true;
  const merged=mergeAvatarRendererSignals(plan,signals),nextProfile=selectAvatarPerformanceProfile(merged);
  if(nextProfile!==plan.profile)return true;
  if(Boolean(merged.reducedMotion)!==Boolean(plan.adaptation?.reducedMotion))return true;
  if(Boolean(merged.background)!==Boolean(plan.adaptation?.background))return true;
  if(clean(merged.thermalState,20)!==plan.adaptation?.thermalState)return true;
  if(clean(merged.deviceTier,20)!==plan.adaptation?.deviceTier)return true;
  if(Math.abs(clamp(merged.batteryLevel,0,1)-Number(plan.adaptation?.batteryLevel||0))>.05)return true;
  return false;
}

export function buildMobileAvatarSurfaceContract({platform="generic"}={}){
  const p=String(platform||"generic").toLowerCase();
  return{contract:"laneriq-mobile-avatar-surface-v1",platform:["ios","android"].includes(p)?p:"generic",primarySurface:"in-app-character",surfaces:["in-app-character","compact-character-card","voice-session-surface","notification-state"],continuousCharacterRendering:"in-app-only",backgroundPolicy:"state-only-no-continuous-render",localRuntimePreferred:true};
}
