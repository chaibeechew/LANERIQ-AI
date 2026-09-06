const PLATFORM_BACKENDS=Object.freeze({ios:new Set(["metal"]),android:new Set(["vulkan","opengles3"]),desktop:new Set(["metal","vulkan","d3d12"])});
function clean(value,max=120){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function percentile(values,p){const list=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!list.length)return null;const index=Math.min(list.length-1,Math.max(0,Math.ceil((p/100)*list.length)-1));return list[index];}
function platformName(value){const p=clean(value,24).toLowerCase();return PLATFORM_BACKENDS[p]?p:"unknown";}

export function getAvatarNativeRendererCapabilities({platform="unknown"}={}){
  const p=platformName(platform),backends=p==="unknown"?[]:[...PLATFORM_BACKENDS[p]];
  return{contract:"laneriq-avatar-native-renderer-bridge-v1",platform:p,supportedBackends:backends,commandBridgeCode:true,nativeHostRequired:true,photorealAssetPipelineRequired:true,nativeRendererLive:false};
}

export function createAvatarNativeRendererBridge({characterId,platform="unknown",backend="",deviceModel="unknown",nativeRuntimeVersion="",physicalDevice=false}={}){
  const id=clean(characterId,96),p=platformName(platform),b=clean(backend,24).toLowerCase();if(!id)throw new Error("AVATAR_NATIVE_RENDERER_CHARACTER_REQUIRED");if(p==="unknown")throw new Error("AVATAR_NATIVE_RENDERER_PLATFORM_REQUIRED");if(!PLATFORM_BACKENDS[p].has(b))throw new Error("AVATAR_NATIVE_RENDERER_BACKEND_UNSUPPORTED");
  return{contract:"laneriq-avatar-native-renderer-bridge-v1",characterId:id,platform:p,backend:b,deviceModel:clean(deviceModel,80)||"unknown",nativeRuntimeVersion:clean(nativeRuntimeVersion,48),physicalDevice:Boolean(physicalDevice),createdAtMs:Date.now(),sequence:0,telemetry:[],crashCount:0,criticalThermalCount:0};
}

export function buildAvatarNativeRendererCommand({bridge,renderPacket,motionPacket,face52,frameId=0,atMs=0}={}){
  if(bridge?.contract!=="laneriq-avatar-native-renderer-bridge-v1")throw new Error("AVATAR_NATIVE_RENDERER_BRIDGE_REQUIRED");if(renderPacket?.characterId!==bridge.characterId)throw new Error("AVATAR_NATIVE_RENDERER_CHARACTER_MISMATCH");if(face52&&face52.characterId&&face52.characterId!==bridge.characterId)throw new Error("AVATAR_NATIVE_FACE_CHARACTER_MISMATCH");
  const channels=Array.isArray(face52?.channels)?face52.channels.slice(0,52).map(entry=>({name:clean(entry?.name,48),value:clamp(entry?.value,0,1)})):[];
  return{contract:"laneriq-avatar-native-render-command-v1",characterId:bridge.characterId,frameId:Math.max(0,Math.floor(Number(frameId)||0)),atMs:Math.max(0,Math.floor(Number(atMs)||0)),platform:bridge.platform,backend:bridge.backend,render:{profile:clean(renderPacket?.profile,24),renderer:clean(renderPacket?.renderer,24),state:clean(renderPacket?.state,24),renderScale:clamp(renderPacket?.renderScale,.4,1)},motion:{contract:clean(motionPacket?.contract,64),lookTarget:motionPacket?.lookTarget||null,handTarget:motionPacket?.handTarget||null},face52:{channelCount:channels.length,channels},privacy:{rawReferenceAssetIncluded:false,rawMemoryIncluded:false,providerIdentityIncluded:false}};
}

export function recordAvatarNativeRendererTelemetry(bridge,{atMs=Date.now(),frameMs=null,gpuMs=null,droppedFrame=false,thermalState="unknown",memoryMb=null,crash=false}={}){
  if(bridge?.contract!=="laneriq-avatar-native-renderer-bridge-v1")throw new Error("AVATAR_NATIVE_RENDERER_BRIDGE_REQUIRED");const thermal=clean(thermalState,24).toLowerCase()||"unknown",sample={atMs:Number(atMs)||Date.now(),frameMs:Number.isFinite(Number(frameMs))?Math.max(0,Number(frameMs)):null,gpuMs:Number.isFinite(Number(gpuMs))?Math.max(0,Number(gpuMs)):null,droppedFrame:Boolean(droppedFrame),thermalState:thermal,memoryMb:Number.isFinite(Number(memoryMb))?Math.max(0,Number(memoryMb)):null,crash:Boolean(crash)};
  return{...bridge,sequence:(bridge.sequence||0)+1,telemetry:[...(bridge.telemetry||[]),sample].slice(-7200),crashCount:(bridge.crashCount||0)+(sample.crash?1:0),criticalThermalCount:(bridge.criticalThermalCount||0)+(/critical|serious/.test(thermal)?1:0)};
}

export function evaluateAvatarNativeRendererProbe(bridge,{minFrames=120,maxFrameP95Ms=41.7,maxGpuP95Ms=35,maxDroppedFrameRate=.02,maxMemoryMb=500}={}){
  if(bridge?.contract!=="laneriq-avatar-native-renderer-bridge-v1")return{pass:false,reasons:["NATIVE_RENDERER_BRIDGE_REQUIRED"]};const samples=bridge.telemetry||[],frame=samples.map(x=>x.frameMs).filter(Number.isFinite),gpu=samples.map(x=>x.gpuMs).filter(Number.isFinite),memory=samples.map(x=>x.memoryMb).filter(Number.isFinite),frameP95Ms=percentile(frame,95),gpuP95Ms=percentile(gpu,95),droppedRate=samples.length?samples.filter(x=>x.droppedFrame).length/samples.length:1,memoryPeakMb=memory.length?Math.max(...memory):null,reasons=[];
  if(!bridge.physicalDevice||bridge.deviceModel==="unknown"||!bridge.nativeRuntimeVersion)reasons.push("PHYSICAL_NATIVE_DEVICE_EVIDENCE_REQUIRED");if(samples.length<Math.max(30,Number(minFrames)||120))reasons.push("NATIVE_RENDERER_SAMPLE_COUNT_LOW");if(frameP95Ms==null||frameP95Ms>maxFrameP95Ms)reasons.push("NATIVE_FRAME_TIME_HIGH");if(gpuP95Ms!=null&&gpuP95Ms>maxGpuP95Ms)reasons.push("NATIVE_GPU_TIME_HIGH");if(droppedRate>maxDroppedFrameRate)reasons.push("NATIVE_DROPPED_FRAME_RATE_HIGH");if(memoryPeakMb!=null&&memoryPeakMb>maxMemoryMb)reasons.push("NATIVE_MEMORY_HIGH");if((bridge.crashCount||0)>0)reasons.push("NATIVE_RENDERER_CRASH");if((bridge.criticalThermalCount||0)>0)reasons.push("NATIVE_RENDERER_THERMAL_PRESSURE");
  return{contract:"laneriq-avatar-native-renderer-probe-v1",pass:reasons.length===0,reasons,metrics:{sampleCount:samples.length,frameP95Ms,gpuP95Ms,droppedFrameRate:droppedRate,memoryPeakMb},evidence:{physicalDevice:Boolean(bridge.physicalDevice),platform:bridge.platform,backend:bridge.backend,deviceModel:bridge.deviceModel,nativeRuntimeVersion:bridge.nativeRuntimeVersion}};
}

export function getAvatarNativeRendererReadiness(){return{contract:"laneriq-avatar-native-renderer-bridge-v1",codeReady:true,commandBridgeCode:true,physicalProbeCode:true,nativeRendererLive:false,photorealAssetPipelineLive:false};}
