function clean(value,max=96){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
const BACKENDS=Object.freeze({ios:["metal"],android:["vulkan","opengles3"],desktop:["metal","vulkan","d3d12"]});

export function buildAvatarNativeAssetContract({characterId,platform="unknown",meshLods=[],skeletonBones=0,blendshapeChannels=52,materialCount=0,textureMemoryMb=0}={}){
  const id=clean(characterId),p=clean(platform,24).toLowerCase();if(!id||!BACKENDS[p])throw new Error("AVATAR_NATIVE_ASSET_CONTEXT_REQUIRED");
  const lods=(Array.isArray(meshLods)?meshLods:[]).slice(0,4).map((lod,index)=>({level:index,vertices:Math.max(0,Math.floor(Number(lod?.vertices)||0)),triangles:Math.max(0,Math.floor(Number(lod?.triangles)||0)),screenCoverage:clamp(lod?.screenCoverage,0,1)}));
  return{contract:"laneriq-avatar-native-asset-contract-v2",characterId:id,platform:p,meshLods:lods,skeletonBones:Math.max(0,Math.min(256,Math.floor(Number(skeletonBones)||0))),blendshapeChannels:Math.max(0,Math.min(52,Math.floor(Number(blendshapeChannels)||0))),materialCount:Math.max(0,Math.min(32,Math.floor(Number(materialCount)||0))),textureMemoryMb:clamp(textureMemoryMb,0,512),requirements:{skinnedMesh:true,normalizedSkeleton:true,face52Preferred:true,pbrMaterials:true,privateAssetRefsOnly:true,rawReferenceAssetIncluded:false},highFidelityAssetReady:lods.length>=2&&Number(skeletonBones)>=55&&Number(blendshapeChannels)>=40};
}

export function buildAvatarNativeFrameGraph({platform="unknown",backend="",profile="balanced",assetContract}={}){
  const p=clean(platform,24).toLowerCase(),b=clean(backend,24).toLowerCase();if(!BACKENDS[p]?.includes(b))throw new Error("AVATAR_NATIVE_FRAMEGRAPH_BACKEND_UNSUPPORTED");if(assetContract?.contract!=="laneriq-avatar-native-asset-contract-v2")throw new Error("AVATAR_NATIVE_ASSET_CONTRACT_REQUIRED");
  const perf=clean(profile,24).toLowerCase()==="performance";
  return{contract:"laneriq-avatar-native-frame-graph-v2",platform:p,backend:b,passes:["animation-sample","skeleton-skinning","face-blendshapes","depth-prepass","opaque-pbr","eyes-hair","transparent","postprocess","present"],budgets:{targetFps:perf?60:30,maxGpuFrameMs:perf?16.7:30,maxDrawCalls:perf?120:72,maxBones:perf?160:96,maxFaceChannels:perf?52:32,maxTextureMemoryMb:perf?220:128},dynamicResolution:{enabled:true,minScale:.65,maxScale:1,step:.05},truth:{nativePipelineCode:true,nativeHostRequired:true,physicalDeviceEvidenceRequired:true,highFidelityNativeRendererLive:false}};
}

export function chooseAvatarNativeQuality({frameGraph,gpuP95Ms=null,thermalState="unknown",batteryLevel=1,currentScale=1}={}){
  if(frameGraph?.contract!=="laneriq-avatar-native-frame-graph-v2")throw new Error("AVATAR_NATIVE_FRAME_GRAPH_REQUIRED");const thermal=clean(thermalState,24).toLowerCase(),budget=frameGraph.budgets.maxGpuFrameMs,gpu=Number(gpuP95Ms),hot=/serious|critical/.test(thermal),lowBattery=Number(batteryLevel)<.2,over=Number.isFinite(gpu)&&gpu>budget;
  const scale=clamp((hot||lowBattery||over)?Number(currentScale)-frameGraph.dynamicResolution.step:Number(currentScale)+.02,frameGraph.dynamicResolution.minScale,frameGraph.dynamicResolution.maxScale);
  return{contract:"laneriq-avatar-native-quality-decision-v2",renderScale:Number(scale.toFixed(2)),reduceSecondaryMotion:hot||lowBattery,disableParticles:hot||lowBattery||over,preferLowerLod:hot||over,targetFps:hot?24:frameGraph.budgets.targetFps,reasons:[hot&&"thermal-pressure",lowBattery&&"low-battery",over&&"gpu-over-budget"].filter(Boolean)};
}

export function evaluateAvatarNativePipelineEvidence({assetContract,frameGraph,physicalProbe=null,animationErrorP95=1,faceChannelCoverage=0}={}){
  const reasons=[];if(!assetContract?.highFidelityAssetReady)reasons.push("HIGH_FIDELITY_ASSET_PIPELINE_INCOMPLETE");if(frameGraph?.contract!=="laneriq-avatar-native-frame-graph-v2")reasons.push("NATIVE_FRAME_GRAPH_REQUIRED");if(physicalProbe?.pass!==true)reasons.push("PHYSICAL_NATIVE_RENDERER_PROBE_REQUIRED");if(Number(animationErrorP95)>.03)reasons.push("NATIVE_ANIMATION_ERROR_HIGH");if(Number(faceChannelCoverage)<.9)reasons.push("FACE52_COVERAGE_LOW");return{contract:"laneriq-avatar-native-pipeline-evidence-v2",pass:reasons.length===0,reasons,highFidelityNativeRendererLive:false,promotionEligible:reasons.length===0&&physicalProbe?.evidence?.physicalDevice===true};
}

export function getAvatarNativeRendererPipelineV2Readiness(){return{contract:"laneriq-avatar-native-renderer-pipeline-v2",assetPipelineCode:true,frameGraphCode:true,dynamicResolutionCode:true,physicalEvidenceGate:true,codeReady:true,highFidelityNativeRendererLive:false};}
