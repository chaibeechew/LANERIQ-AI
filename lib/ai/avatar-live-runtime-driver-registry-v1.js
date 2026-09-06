function clean(v,max=160){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
const DRIVER_TYPES=new Set(["native-renderer","neural-voice","neural-motion","multimodal-perception","secure-hardware","physical-device","production-runtime"]);
export const AVATAR_LIVE_RUNTIME_DRIVER_REGISTRY_V1="laneriq-avatar-live-runtime-driver-registry-v1";

export function createAvatarLiveRuntimeDriverRegistry(){return{contract:AVATAR_LIVE_RUNTIME_DRIVER_REGISTRY_V1,revision:0,drivers:new Map(),metadata:{}};}

export function registerAvatarLiveRuntimeDriver(registry,{driverType,driverId,version,execute,capabilities=[],platforms=[],productionAllowed=false}={}){
  if(registry?.contract!==AVATAR_LIVE_RUNTIME_DRIVER_REGISTRY_V1)throw new Error("AVATAR_LIVE_DRIVER_REGISTRY_REQUIRED");
  const type=clean(driverType,48).toLowerCase(),id=clean(driverId,120),ver=clean(version,80);
  if(!DRIVER_TYPES.has(type)||!id||!ver||typeof execute!=="function")throw new Error("AVATAR_LIVE_DRIVER_INVALID");
  const next={...registry,revision:(Number(registry.revision)||0)+1,drivers:new Map(registry.drivers),metadata:{...(registry.metadata||{})}};
  next.drivers.set(type,{driverType:type,driverId:id,version:ver,execute,capabilities:[...new Set((Array.isArray(capabilities)?capabilities:[]).map(x=>clean(x,80)).filter(Boolean))],platforms:[...new Set((Array.isArray(platforms)?platforms:[]).map(x=>clean(x,32).toLowerCase()).filter(Boolean))],productionAllowed:Boolean(productionAllowed),registeredRevision:next.revision});
  next.metadata[type]={driverId:id,version:ver,capabilities:next.drivers.get(type).capabilities,platforms:next.drivers.get(type).platforms,productionAllowed:Boolean(productionAllowed),registeredRevision:next.revision};
  return next;
}

export function getAvatarLiveRuntimeDriver(registry,driverType){if(registry?.contract!==AVATAR_LIVE_RUNTIME_DRIVER_REGISTRY_V1)return null;return registry.drivers.get(clean(driverType,48).toLowerCase())||null;}

export function evaluateAvatarLiveRuntimeDriver(registry,{driverType,capability="",platform="",environment="preview"}={}){
  const type=clean(driverType,48).toLowerCase(),driver=getAvatarLiveRuntimeDriver(registry,type),reasons=[];
  if(!driver)reasons.push("LIVE_DRIVER_REQUIRED");
  const cap=clean(capability,80),p=clean(platform,32).toLowerCase(),env=clean(environment,32).toLowerCase();
  if(driver&&cap&&driver.capabilities.length&&!driver.capabilities.includes(cap))reasons.push("LIVE_DRIVER_CAPABILITY_UNSUPPORTED");
  if(driver&&p&&driver.platforms.length&&!driver.platforms.includes(p))reasons.push("LIVE_DRIVER_PLATFORM_UNSUPPORTED");
  if(driver&&env==="production"&&driver.productionAllowed!==true)reasons.push("LIVE_DRIVER_PRODUCTION_NOT_APPROVED");
  return{contract:"laneriq-avatar-live-runtime-driver-evaluation-v1",pass:reasons.length===0,reasons,driverType:type,driverId:driver?.driverId||"",version:driver?.version||"",automaticPromotion:false};
}

export function getAvatarLiveRuntimeDriverRegistryReadiness(){return{contract:AVATAR_LIVE_RUNTIME_DRIVER_REGISTRY_V1,dependencyInjection:true,providerNeutral:true,nativeDriver:true,voiceDriver:true,motionDriver:true,perceptionDriver:true,secureHardwareDriver:true,physicalDeviceDriver:true,productionRuntimeDriver:true,productionApprovalGate:true,codeReady:true,externalDriversLive:false};}
