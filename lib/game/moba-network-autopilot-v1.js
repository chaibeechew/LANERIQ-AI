function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function text(value,max=128){return String(value??"").trim().slice(0,max);}
function positiveInt(value,fallback=1){return Math.max(1,Math.floor(finite(value,fallback)));}

export const MOBA_NETWORK_AUTOPILOT_V1=Object.freeze({
  version:"moba-network-autopilot-v1",
  playersPerMatch:10,
  teamSize:5,
  defaultTickRate:20,
  defaultSnapshotRate:10,
  providerOpaque:true,
  dedicatedLanerIqServerRequired:false,
  requiredCapabilities:["relay","matchmaking","authoritativeHost","reconnect","snapshotDelta","heartbeat"],
  userFacingInputs:["mode","region","expectedConcurrentPlayers"],
  automation:["provider-selection","match-host-allocation","relay-selection","matchmaking","health-heartbeat","capacity-check","failover-plan","simulation-fallback"],
  truthRule:"Network Autopilot can select and configure already-connected provider adapters, but it does not create external provider accounts, credentials or LIVE capacity evidence by itself."
});

function capabilities(provider={}){const c=provider.capabilities&&typeof provider.capabilities==="object"?provider.capabilities:{};return{
  relay:c.relay===true,matchmaking:c.matchmaking===true,authoritativeHost:c.authoritativeHost===true,reconnect:c.reconnect===true,snapshotDelta:c.snapshotDelta===true,heartbeat:c.heartbeat===true,regionalFailover:c.regionalFailover===true,
  tickRate:positiveInt(c.tickRate||provider.tickRate,0),regions:Array.isArray(c.regions)?c.regions.map(item=>text(item,64).toLowerCase()).filter(Boolean):Array.isArray(provider.regions)?provider.regions.map(item=>text(item,64).toLowerCase()).filter(Boolean):[]
};}
function missingCapabilities(provider){const c=capabilities(provider);return MOBA_NETWORK_AUTOPILOT_V1.requiredCapabilities.filter(key=>c[key]!==true);}
function providerScore(provider,targetPlayers,requiredTickRate){const c=capabilities(provider),latency=clamp(provider.latencyMs??180,0,5000),jitter=clamp(provider.jitterMs??30,0,2000),loss=clamp(provider.packetLossPct??1,0,100),reliability=clamp(provider.reliabilityScore??80,0,100),exit=clamp(provider.exitReadinessScore??50,0,100),maxPlayers=Math.max(0,Math.floor(finite(provider.maxConcurrentPlayers,0))),headroom=maxPlayers>0?clamp((maxPlayers-targetPlayers)/Math.max(targetPlayers,1),-1,4):0,cost=Math.max(0,finite(provider.estimatedHourlyCostUsd,0));return Number((100+reliability*.25+exit*.08+headroom*8+(c.regionalFailover?5:0)+(c.tickRate>=requiredTickRate?4:0)-latency*.07-jitter*.09-loss*1.6-cost*7).toFixed(4));}

export function planMobaNetworkAutopilot({
  expectedConcurrentPlayers=10,
  region="auto",
  mode="5v5",
  providers=[],
  requiredTickRate=MOBA_NETWORK_AUTOPILOT_V1.defaultTickRate,
  paidRoutingAllowed=false,
  maximumEstimatedHourlyCostUsd=0,
}={}){
  const target=positiveInt(expectedConcurrentPlayers,10),wantedRegion=text(region,64).toLowerCase()||"auto",tick=positiveInt(requiredTickRate,20),maxCost=Math.max(0,finite(maximumEstimatedHourlyCostUsd,0)),eligible=[],rejected=[];
  for(const raw of Array.isArray(providers)?providers:[]){const id=text(raw?.id,96);if(!id){rejected.push({providerId:null,reason:"provider_id_required"});continue;}const c=capabilities(raw),missing=missingCapabilities(raw),cost=Math.max(0,finite(raw.estimatedHourlyCostUsd,0)),maxPlayers=Math.max(0,Math.floor(finite(raw.maxConcurrentPlayers,0)));let reason=null;
    if(raw.connected!==true)reason="provider_not_connected";
    else if(raw.healthy===false)reason="provider_unhealthy";
    else if(raw.commercialUseAllowed===false)reason="commercial_use_not_allowed";
    else if(missing.length)reason=`missing_capability:${missing.join(",")}`;
    else if(c.tickRate<tick)reason="tick_rate_below_requirement";
    else if(maxPlayers>0&&maxPlayers<target)reason="declared_capacity_below_target";
    else if(wantedRegion!=="auto"&&c.regions.length&&!c.regions.includes(wantedRegion))reason="required_region_not_supported";
    else if(!paidRoutingAllowed&&cost>0)reason="paid_routing_not_authorized";
    else if(cost>maxCost)reason="estimated_cost_above_cap";
    if(reason)rejected.push({providerId:id,reason});else eligible.push({...raw,id,score:providerScore(raw,target,tick),capabilities:c});
  }
  eligible.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const selected=eligible[0]||null;
  return Object.freeze({
    version:MOBA_NETWORK_AUTOPILOT_V1.version,
    decision:selected?"connect":"simulate",
    mode:text(mode,48)||"5v5",
    expectedConcurrentPlayers:target,
    expectedConcurrentMatches:Math.ceil(target/MOBA_NETWORK_AUTOPILOT_V1.playersPerMatch),
    region:wantedRegion,
    providerId:selected?.id||null,
    fallbackProviderIds:Object.freeze(eligible.slice(1,4).map(item=>item.id)),
    rejected:Object.freeze(rejected),
    providerOpaque:true,
    credentialsExposedToGameCreator:false,
    dedicatedLanerIqServerRequired:false,
    steps:Object.freeze(selected?["allocate_authoritative_match_host","attach_relay_transport","open_matchmaking_queue","enable_snapshot_delta_and_heartbeat","enable_reconnect_resync","start_capacity_telemetry","arm_provider_failover"]:["run_synthetic_capacity_simulation","keep_bot_training_available","request_platform_provider_connection_for_live_5v5"]),
    userActionRequired:selected?"none_for_normal_game_creation":"none_for_simulation; platform operator must connect a live provider before real-player 5v5",
    productionEvidenceVerified:false,
    truthRule:MOBA_NETWORK_AUTOPILOT_V1.truthRule
  });
}

export function simulateMobaCapacity({
  provider={},
  targetConcurrentPlayers=10,
  playersPerMatch=10,
  tickRate=20,
  snapshotRate=10,
  inputPacketsPerSecond=14,
  inputPacketBytes=72,
  deltaSnapshotBytes=220,
  targetHeadroomRatio=.7,
}={}){
  const players=positiveInt(targetConcurrentPlayers,10),ppm=positiveInt(playersPerMatch,10),tick=positiveInt(tickRate,20),snap=positiveInt(snapshotRate,10),inputs=positiveInt(inputPacketsPerSecond,14),headroom=clamp(targetHeadroomRatio,.25,.9),matches=Math.ceil(players/ppm);
  const maxPlayers=Math.max(0,Math.floor(finite(provider.maxConcurrentPlayers,0))),maxMatches=Math.max(0,Math.floor(finite(provider.maxConcurrentMatches,0))),maxTicks=Math.max(0,finite(provider.maxAuthoritativeTicksPerSecond,0)),maxEgress=Math.max(0,finite(provider.maxEgressMbps,0));
  const perPlayerIngressMbps=inputs*Math.max(24,finite(inputPacketBytes,72))*8/1e6;
  const perPlayerEgressMbps=snap*Math.max(64,finite(deltaSnapshotBytes,220))*8/1e6*1.35;
  const byPlayers=maxPlayers||Infinity,byMatches=maxMatches?maxMatches*ppm:Infinity,byTicks=maxTicks?Math.floor(maxTicks/tick)*ppm:Infinity,byNetwork=maxEgress?Math.floor(maxEgress/Math.max(perPlayerEgressMbps,.0001)):Infinity;
  const raw=Math.min(byPlayers,byMatches,byTicks,byNetwork),capacityKnown=Number.isFinite(raw),modeledStablePlayers=capacityKnown?Math.max(0,Math.floor(raw*headroom/ppm)*ppm):0,rawModeledCeiling=capacityKnown?Math.max(0,Math.floor(raw/ppm)*ppm):0;
  const latency=clamp(provider.latencyMs??180,0,5000),jitter=clamp(provider.jitterMs??30,0,2000),loss=clamp(provider.packetLossPct??1,0,100),networkGood=latency<=180&&jitter<=50&&loss<=2,withinStable=capacityKnown&&players<=modeledStablePlayers,withinCeiling=capacityKnown&&players<=rawModeledCeiling;
  const smoothnessGrade=!capacityKnown?"unknown":withinStable&&networkGood?"modeled_smooth":withinCeiling?"modeled_degraded_risk":"modeled_over_capacity";
  const crashRisk=!capacityKnown?"unknown":withinStable?"low_model_risk":withinCeiling?"elevated_model_risk":"high_model_risk";
  const limitingFactors=[];if(capacityKnown){if(raw===byPlayers)limitingFactors.push("declared_player_capacity");if(raw===byMatches)limitingFactors.push("declared_match_capacity");if(raw===byTicks)limitingFactors.push("authoritative_tick_throughput");if(raw===byNetwork)limitingFactors.push("egress_bandwidth");}
  return Object.freeze({
    version:MOBA_NETWORK_AUTOPILOT_V1.version,
    evidenceLevel:"synthetic_model",
    targetConcurrentPlayers:players,
    targetConcurrentMatches:matches,
    modeledStablePlayers,
    rawModeledCeiling,
    capacityKnown,
    smoothnessGrade,
    crashRisk,
    networkModel:Object.freeze({latencyMs:latency,jitterMs:jitter,packetLossPct:loss,perPlayerIngressMbps:Number(perPlayerIngressMbps.toFixed(5)),perPlayerEgressMbps:Number(perPlayerEgressMbps.toFixed(5)),requiredTickExecutionsPerSecond:matches*tick,requiredSnapshotDeliveriesPerSecond:players*snap}),
    limitingFactors:Object.freeze(limitingFactors),
    headroomRatio:headroom,
    liveCapacityClaimAllowed:false,
    crashFreeClaimAllowed:false,
    productionTrafficSent:false,
    truthRule:"This is a deterministic capacity model, not a live load test. It can estimate likely headroom and bottlenecks, but it cannot prove a gamer count is crash-free or production-smooth until measured Preview/Production load and real-device network evidence pass."
  });
}

export function evaluateMobaNetworkAutopilotEvidence(evidence={}){const checks={providerSelection:evidence.providerSelection===true,providerOpaque:evidence.providerOpaque===true,capacitySimulation:evidence.capacitySimulation===true,automaticFallback:evidence.automaticFallback===true,costPolicy:evidence.costPolicy===true,regionPolicy:evidence.regionPolicy===true,liveProvider:evidence.liveProvider===true,measuredLoad:evidence.measuredLoad===true,realDevices:evidence.realDevices===true,failover:evidence.failover===true};const internal=["providerSelection","providerOpaque","capacitySimulation","automaticFallback","costPolicy","regionPolicy"].every(key=>checks[key]);const production=Object.values(checks).every(Boolean);return{internalReady:internal,productionReady:production,checks,missing:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),truthRule:"Autopilot internal readiness is not LIVE provider readiness; production requires connected provider, measured load, real devices and failover evidence."};}
