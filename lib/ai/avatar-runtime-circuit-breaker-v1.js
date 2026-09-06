function clean(v,max=120){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f;}
export const AVATAR_RUNTIME_CIRCUIT_BREAKER_V1="laneriq-avatar-runtime-circuit-breaker-v1";

export function createAvatarRuntimeCircuitBreaker({driverId,failureThreshold=3,cooldownMs=30000,maxSamples=20}={}){
  const id=clean(driverId,120);if(!id)throw new Error("AVATAR_RUNTIME_DRIVER_ID_REQUIRED");return{contract:AVATAR_RUNTIME_CIRCUIT_BREAKER_V1,driverId:id,state:"closed",failureThreshold:Math.max(2,Math.min(10,Math.floor(n(failureThreshold,3)))),cooldownMs:Math.max(5000,Math.min(300000,n(cooldownMs,30000))),maxSamples:Math.max(5,Math.min(100,Math.floor(n(maxSamples,20)))),consecutiveFailures:0,samples:[],openedAtMs:0,lastAttemptAtMs:0};
}

export function canExecuteAvatarRuntimeDriver(breaker,{nowMs=Date.now()}={}){
  if(breaker?.contract!==AVATAR_RUNTIME_CIRCUIT_BREAKER_V1)throw new Error("AVATAR_RUNTIME_CIRCUIT_BREAKER_REQUIRED");const now=n(nowMs,Date.now());if(breaker.state!=="open")return{allowed:true,state:breaker.state};const elapsed=Math.max(0,now-n(breaker.openedAtMs,0));return elapsed>=breaker.cooldownMs?{allowed:true,state:"half-open"}:{allowed:false,state:"open",retryAfterMs:breaker.cooldownMs-elapsed};
}

export function recordAvatarRuntimeDriverResult(breaker,{pass=false,latencyMs=0,errorCode="",nowMs=Date.now()}={}){
  if(breaker?.contract!==AVATAR_RUNTIME_CIRCUIT_BREAKER_V1)throw new Error("AVATAR_RUNTIME_CIRCUIT_BREAKER_REQUIRED");const now=n(nowMs,Date.now()),sample={pass:Boolean(pass),latencyMs:Math.max(0,n(latencyMs,0)),errorCode:clean(errorCode,120),atMs:now},samples=[...(breaker.samples||[]),sample].slice(-breaker.maxSamples);let consecutiveFailures=pass?0:(n(breaker.consecutiveFailures,0)+1),state=breaker.state,openedAtMs=n(breaker.openedAtMs,0);if(pass){state="closed";openedAtMs=0;}else if(consecutiveFailures>=breaker.failureThreshold){state="open";openedAtMs=now;}return{...breaker,state,consecutiveFailures,samples,openedAtMs,lastAttemptAtMs:now};
}

export function summarizeAvatarRuntimeCircuitBreaker(breaker={}){const samples=Array.isArray(breaker.samples)?breaker.samples:[],passCount=samples.filter(x=>x.pass).length,avgLatencyMs=samples.length?Math.round(samples.reduce((s,x)=>s+n(x.latencyMs,0),0)/samples.length):0;return{contract:"laneriq-avatar-runtime-circuit-breaker-summary-v1",driverId:breaker.driverId||"",state:breaker.state||"closed",sampleCount:samples.length,successRate:samples.length?Math.round(passCount/samples.length*1000)/1000:0,avgLatencyMs,consecutiveFailures:n(breaker.consecutiveFailures,0),failClosed:true};}

export function getAvatarRuntimeCircuitBreakerReadiness(){return{contract:AVATAR_RUNTIME_CIRCUIT_BREAKER_V1,closedOpenHalfOpen:true,boundedCooldown:true,latencyHistory:true,failureIsolation:true,localFallbackExpected:true,codeReady:true,runtimeHealthLive:false};}
