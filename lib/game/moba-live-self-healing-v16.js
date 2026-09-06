function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''))}

export const MOBA_LIVE_SELF_HEALING_V16=freeze({
  version:'moba-live-self-healing-v16',
  providerNeutral:true,
  trustedTelemetryRequired:true,
  systems:freeze(['telemetry-slo','hysteresis','admission-throttle','region-failover','provider-failover','canary-rollback','ranked-protection']),
  truthRule:'V16 decisions are advisory until a connected operator/provider adapter executes them. Synthetic or untrusted telemetry cannot authorize a Production recovery claim.'
})

export function evaluateMobaTelemetryWindow(t={}){
  const trusted=t.trustedCollector===true&&t.measured===true&&t.synthetic!==true
  const buildSha=validSha(t.buildSha)?t.buildSha:null
  const exactBuildBound=Boolean(buildSha&&t.deploymentBuildSha===buildSha)
  const metrics=freeze({tickP95Ms:finite(t.tickP95Ms,Infinity),latencyP95Ms:finite(t.latencyP95Ms,Infinity),packetLossPct:finite(t.packetLossPct,Infinity),crashRatePct:finite(t.crashRatePct,Infinity),errorRatePct:finite(t.errorRatePct,Infinity),cpuPct:finite(t.cpuPct,Infinity),reconnectSuccessRate:finite(t.reconnectSuccessRate,0)})
  const breaches=freeze({tick:metrics.tickP95Ms>50,latency:metrics.latencyP95Ms>250,loss:metrics.packetLossPct>5,crash:metrics.crashRatePct>0.1,error:metrics.errorRatePct>1,cpu:metrics.cpuPct>90,reconnect:metrics.reconnectSuccessRate<0.99})
  const breachCount=Object.values(breaches).filter(Boolean).length
  return freeze({trusted,healthy:trusted&&breachCount===0,buildSha,exactBuildBound,metrics,breaches,breachCount})
}

export function decideMobaSelfHealingAction({telemetry={},consecutiveBreaches=0,providerHealthy=true,regionHealthy=true,canary=true,ranked=true}={}){
  const w=evaluateMobaTelemetryWindow(telemetry)
  if(!w.trusted)return freeze({version:MOBA_LIVE_SELF_HEALING_V16.version,action:'collect_trusted_telemetry',execute:false,severity:'unknown',productionEvidenceVerified:false,truthRule:MOBA_LIVE_SELF_HEALING_V16.truthRule})
  const fatal=w.metrics.crashRatePct>0.5||w.metrics.errorRatePct>5
  let action='none',severity='healthy'
  if(fatal&&canary){action='rollback_canary';severity='critical'}
  else if(providerHealthy===false){action='provider_failover';severity='critical'}
  else if(regionHealthy===false||w.metrics.latencyP95Ms>350||w.metrics.packetLossPct>8){action='region_failover';severity='high'}
  else if(w.breachCount>0&&consecutiveBreaches>=2){action='throttle_admission';severity='medium'}
  else if(w.breachCount>0){action='degrade_nonessential_vfx';severity='low'}
  const rankedAction=(ranked&&severity!=='healthy')?'pause_ranked_admission':'none'
  return freeze({version:MOBA_LIVE_SELF_HEALING_V16.version,action,rankedAction,severity,execute:action!=='none',telemetryVerified:true,productionEvidenceVerified:false,checks:w,truthRule:MOBA_LIVE_SELF_HEALING_V16.truthRule})
}
