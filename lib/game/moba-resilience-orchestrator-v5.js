function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function integer(value,fallback=0){return Math.max(0,Math.floor(finite(value,fallback)));}
function text(value,max=128){return String(value??"").trim().slice(0,max);}
function list(value){return Array.isArray(value)?value:[];}

export const MOBA_RESILIENCE_ORCHESTRATOR_V5=Object.freeze({
  version:"moba-resilience-orchestrator-v5",
  playersPerMatch:10,
  providerNeutral:true,
  dedicatedLanerIqServerRequired:false,
  zeroTouchCreatorExperience:true,
  targetHostUtilization:.7,
  minWarmHosts:2,
  migrationMaxFreezeMs:250,
  systems:Object.freeze([
    "multi-region-placement","capacity-aware-provider-routing","autoscaling-plan","warm-host-buffer","load-ramp-plan","fault-injection-matrix","host-crash-recovery","region-failover","authoritative-match-migration","split-brain-prevention","capacity-certification","creator-capacity-report"
  ]),
  truthRule:"V5 automates provider-neutral planning, resilience contracts and evidence evaluation. It does not create external provider accounts or turn simulated results into LIVE production evidence."
});

function providerRegions(provider){return list(provider?.regions||provider?.capabilities?.regions).map(v=>text(v,64).toLowerCase()).filter(Boolean);}
function regionLatency(provider,region){const table=provider?.latencyByRegion&&typeof provider.latencyByRegion==="object"?provider.latencyByRegion:{};return clamp(table[region]??provider?.latencyMs??250,0,5000);}
function providerMatchCapacity(provider){return integer(provider?.maxConcurrentMatches,0);}
function providerUsedMatches(provider){return integer(provider?.currentConcurrentMatches,0);}

export function planMobaRegionalPlacement({demandByRegion={},providers=[],reserveRatio=.2}={}){
  const reserve=clamp(reserveRatio,0,.6),rows=[],unplaced=[];
  const state=new Map();
  for(const raw of list(providers)){
    const id=text(raw?.id,96);if(!id)continue;
    state.set(id,{provider:raw,id,used:providerUsedMatches(raw),capacity:providerMatchCapacity(raw)});
  }
  const demandEntries=Object.entries(demandByRegion&&typeof demandByRegion==="object"?demandByRegion:{}).map(([region,matches])=>[text(region,64).toLowerCase(),integer(matches)]).filter(([region,matches])=>region&&matches>0);
  for(const [region,requested] of demandEntries){
    let remaining=requested;
    const candidates=[...state.values()].filter(item=>item.provider?.connected===true&&item.provider?.healthy!==false&&item.provider?.commercialUseAllowed!==false&&(providerRegions(item.provider).length===0||providerRegions(item.provider).includes(region))).sort((a,b)=>regionLatency(a.provider,region)-regionLatency(b.provider,region)||a.id.localeCompare(b.id));
    for(const item of candidates){
      if(remaining<=0)break;
      const reserved=Math.ceil(item.capacity*reserve),available=Math.max(0,item.capacity-reserved-item.used),take=Math.min(remaining,available);
      if(take<=0)continue;
      item.used+=take;remaining-=take;
      rows.push(Object.freeze({region,providerId:item.id,matches:take,players:take*MOBA_RESILIENCE_ORCHESTRATOR_V5.playersPerMatch,latencyEstimateMs:regionLatency(item.provider,region),reservedMatches:reserved}));
    }
    if(remaining>0)unplaced.push(Object.freeze({region,matches:remaining,players:remaining*MOBA_RESILIENCE_ORCHESTRATOR_V5.playersPerMatch,reason:"insufficient_healthy_reserved_capacity"}));
  }
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,placements:Object.freeze(rows),unplaced:Object.freeze(unplaced),fullyPlaced:unplaced.length===0,providerCredentialExposed:false,dedicatedLanerIqServerRequired:false,productionEvidenceVerified:false,truthRule:"Placement uses declared provider health/capacity and reserve headroom. It is an orchestration plan, not proof that external capacity was allocated."});
}

export function calculateMobaAutoscalePlan({activeMatches=0,queuedMatches=0,readyHosts=0,hostMatchCapacity=10,targetUtilization=MOBA_RESILIENCE_ORCHESTRATOR_V5.targetHostUtilization,minWarmHosts=MOBA_RESILIENCE_ORCHESTRATOR_V5.minWarmHosts,maxHosts=1000}={}){
  const active=integer(activeMatches),queued=integer(queuedMatches),ready=integer(readyHosts),capacity=Math.max(1,integer(hostMatchCapacity,10)),target=clamp(targetUtilization,.4,.85),warm=integer(minWarmHosts,2),max=Math.max(warm,integer(maxHosts,1000));
  const demand=active+queued,base=demand===0?0:Math.ceil(demand/(capacity*target)),desired=clamp(base+warm,warm,max),direction=desired>ready?"scale_out":desired<ready?"scale_in":"hold";
  const usableMatches=Math.floor(Math.max(0,desired-warm)*capacity*target),headroomMatches=Math.max(0,desired*capacity-active);
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,activeMatches:active,queuedMatches:queued,currentHosts:ready,desiredHosts:desired,direction,targetUtilization:target,warmHosts:warm,hostMatchCapacity:capacity,usableMatches,headroomMatches,scaleInRequiresDrain:direction==="scale_in",productionActionExecuted:false});
}

export function buildMobaLoadRampPlan({targetConcurrentPlayers=1000,rampMinutes=10,holdMinutes=30,steps=5}={}){
  const target=Math.max(10,integer(targetConcurrentPlayers,1000)),matches=Math.ceil(target/MOBA_RESILIENCE_ORCHESTRATOR_V5.playersPerMatch),count=clamp(integer(steps,5),2,20),ramp=Math.max(1,finite(rampMinutes,10)),hold=Math.max(1,finite(holdMinutes,30));
  const stages=[];for(let i=1;i<=count;i++){const ratio=i/count,players=Math.max(10,Math.ceil(target*ratio/10)*10);stages.push(Object.freeze({stage:i,atMinute:Number((ramp*ratio).toFixed(2)),concurrentPlayers:players,concurrentMatches:Math.ceil(players/10)}));}
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,targetConcurrentPlayers:target,targetConcurrentMatches:matches,rampMinutes:ramp,holdMinutes:hold,stages:Object.freeze(stages),executionMode:"plan_only",truthRule:"A load ramp plan describes how to test capacity. It is not measured evidence until executed against a connected provider with telemetry."});
}

export function createMobaFaultInjectionCampaign({regions=["primary","secondary"],includeRegionFailure=true}={}){
  const rs=list(regions).map(v=>text(v,64)).filter(Boolean),scenarios=[
    {id:"packet-loss-5pct",kind:"network",packetLossPct:5,durationSeconds:60},
    {id:"jitter-100ms",kind:"network",jitterMs:100,durationSeconds:60},
    {id:"latency-250ms",kind:"network",latencyMs:250,durationSeconds:60},
    {id:"relay-disconnect",kind:"relay",durationSeconds:15},
    {id:"authoritative-host-crash",kind:"host",durationSeconds:1},
    {id:"telemetry-gap",kind:"telemetry",durationSeconds:30}
  ];
  if(includeRegionFailure&&rs.length>1)scenarios.push({id:`region-unavailable-${rs[0]}`,kind:"region",region:rs[0],durationSeconds:120});
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,synthetic:true,scenarios:Object.freeze(scenarios.map(Object.freeze)),requiresIsolatedTestEnvironment:true,productionTrafficTargeted:false});
}

export function evaluateMobaFaultCampaign(results=[]){
  const rows=list(results),required=["packet-loss-5pct","relay-disconnect","authoritative-host-crash"],byId=new Map(rows.map(item=>[text(item?.id,96),item]));
  const checks={requiredScenarios:required.every(id=>byId.has(id)),noSplitBrain:rows.length>0&&rows.every(r=>r?.splitBrain!==true),authoritativeContinuity:rows.length>0&&rows.every(r=>r?.sequenceMonotonic===true),resyncRecovery:rows.length>0&&rows.every(r=>r?.resyncRecovered===true),noResultCorruption:rows.length>0&&rows.every(r=>r?.resultCorrupted!==true),boundedRecovery:rows.length>0&&rows.every(r=>finite(r?.recoveryMs,Infinity)<=30000)};
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,passed:Object.values(checks).every(Boolean),checks:Object.freeze(checks),scenarioCount:rows.length,productionEvidence:false,truthRule:"Passing synthetic fault injection proves deterministic recovery contracts only. Production failover requires measured provider failures and telemetry."});
}

export function planMobaMatchMigration({matchId,sourceHostId,sourceRegion,snapshotVersion=0,serverSequence=0,candidates=[]}={}){
  const source=text(sourceHostId,128),region=text(sourceRegion,64).toLowerCase();
  const eligible=list(candidates).filter(c=>text(c?.hostId,128)&&text(c?.hostId,128)!==source&&c?.healthy!==false&&integer(c?.availableMatchSlots,0)>0).sort((a,b)=>{
    const ar=text(a?.region,64).toLowerCase()===region?0:1,br=text(b?.region,64).toLowerCase()===region?0:1;return ar-br+clamp(a?.latencyMs,0,5000)/10000-clamp(b?.latencyMs,0,5000)/10000;
  });
  const target=eligible[0];if(!target)return Object.freeze({ok:false,reason:"no_healthy_migration_target",matchId:text(matchId,160)});
  return Object.freeze({ok:true,version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,matchId:text(matchId,160),sourceHostId:source,targetHostId:text(target.hostId,128),sourceRegion:region,targetRegion:text(target.region,64).toLowerCase(),snapshotVersion:integer(snapshotVersion),lastServerSequence:integer(serverSequence),inputFreezeBudgetMs:MOBA_RESILIENCE_ORCHESTRATOR_V5.migrationMaxFreezeMs,steps:Object.freeze(["freeze-new-authoritative-commits","capture-final-snapshot","transfer-session-tokens","restore-target-authority","verify-sequence-continuity","redirect-relay","unlock-input","drain-source"]),productionActionExecuted:false});
}

export function validateMobaMigrationHandoff({plan,sourceFinal={},targetRestored={},sourceStopped=false}={}){
  if(!plan?.ok)return{ok:false,reason:"migration_plan_required"};
  const checks={snapshotExact:integer(targetRestored?.snapshotVersion,-1)===integer(sourceFinal?.snapshotVersion,-2)&&integer(sourceFinal?.snapshotVersion,-2)>=integer(plan.snapshotVersion),sequenceExact:integer(targetRestored?.serverSequence,-1)===integer(sourceFinal?.serverSequence,-2)&&integer(sourceFinal?.serverSequence,-2)>=integer(plan.lastServerSequence),matchIdentity:text(targetRestored?.matchId,160)===text(plan.matchId,160),sourceStopped:sourceStopped===true,targetAuthoritative:targetRestored?.authoritative===true};
  return Object.freeze({ok:Object.values(checks).every(Boolean),checks:Object.freeze(checks),splitBrainPrevented:checks.sourceStopped&&checks.targetAuthoritative,productionEvidence:false});
}

function measuredLoadChecks(load={},targetPlayers=0){return{
  concurrency:integer(load.concurrentPlayers)>=integer(targetPlayers),
  duration:finite(load.durationMinutes)>=30,
  tickP95:finite(load.serverTickP95Ms,Infinity)<=40,
  tickP99:finite(load.serverTickP99Ms,Infinity)<=50,
  latencyP95:finite(load.latencyP95Ms,Infinity)<=250,
  packetLoss:finite(load.packetLossPct,Infinity)<=5,
  reconnect:finite(load.reconnectSuccessRate,0)>=.99,
  crashRate:finite(load.crashRatePct,Infinity)<=.1,
  errorRate:finite(load.errorRatePct,Infinity)<=1
};}

export function evaluateMobaCapacityCertification({targetConcurrentPlayers=1000,simulation=null,measuredLoad=null,soak=null,failover=null,devices=null}={}){
  const target=Math.max(10,integer(targetConcurrentPlayers,1000)),simOk=simulation?.capacityKnown===true&&integer(simulation?.modeledStablePlayers)>=target;
  const loadChecks=measuredLoadChecks(measuredLoad||{},target),loadOk=Object.values(loadChecks).every(Boolean);
  const soakChecks={duration:finite(soak?.durationMinutes,0)>=120,uncaughtExceptions:integer(soak?.uncaughtExceptions,999)===0,integrityViolations:integer(soak?.integrityViolations,999)===0,crashRate:finite(soak?.crashRatePct,Infinity)<=.1},soakOk=Object.values(soakChecks).every(Boolean);
  const failoverChecks={tested:failover?.tested===true,recovery:finite(failover?.recoveryMs,Infinity)<=30000,dataLoss:integer(failover?.lostAuthoritativeEvents,999)===0,noSplitBrain:failover?.splitBrain===false,resultIntegrity:failover?.resultIntegrity===true},failoverOk=Object.values(failoverChecks).every(Boolean);
  const deviceChecks={ios:devices?.ios===true,android:devices?.android===true},devicesOk=Object.values(deviceChecks).every(Boolean);
  const level=simOk&&loadOk&&soakOk&&failoverOk&&devicesOk?"production_certified":simOk&&loadOk?"measured_preview":"simulation_only";
  const verifiedConcurrentPlayers=level==="production_certified"?target:level==="measured_preview"?Math.min(target,integer(measuredLoad?.concurrentPlayers)):0;
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,level,targetConcurrentPlayers:target,verifiedConcurrentPlayers,simulationPassed:simOk,measuredLoadPassed:loadOk,soakPassed:soakOk,failoverPassed:failoverOk,realDevicesPassed:devicesOk,checks:Object.freeze({load:Object.freeze(loadChecks),soak:Object.freeze(soakChecks),failover:Object.freeze(failoverChecks),devices:Object.freeze(deviceChecks)}),capacityClaimAllowed:level==="production_certified",stabilityVerified:level==="production_certified",zeroCrashGuarantee:false,zeroBugGuarantee:false,truthRule:"Production certification means the stated concurrency target passed the defined measured load/soak/failover/device envelope. It never guarantees zero crashes or zero bugs under all future conditions."});
}

export function buildMobaCreatorCapacityReport({certification,simulation}={}){
  const level=certification?.level||"simulation_only",target=integer(certification?.targetConcurrentPlayers||simulation?.targetConcurrentPlayers,0),modeled=integer(simulation?.modeledStablePlayers,0),verified=integer(certification?.verifiedConcurrentPlayers,0);
  const headline=level==="production_certified"?`Verified for ${verified.toLocaleString("en-US")} concurrent players under the certified test envelope.`:level==="measured_preview"?`Measured preview passed at up to ${verified.toLocaleString("en-US")} concurrent players; production certification is still pending.`:`Simulation estimates up to ${modeled.toLocaleString("en-US")} stable concurrent players; live verification is still required.`;
  return Object.freeze({version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,level,targetConcurrentPlayers:target,modeledStablePlayers:modeled,verifiedConcurrentPlayers:verified,headline,showCrashFreeBadge:false,showZeroBugBadge:false,creatorNeedsServerExpertise:false,providerDetailsHidden:true});
}

export function evaluateMobaResilienceV5(evidence={}){const checks={regionalPlacement:evidence.regionalPlacement===true,autoscaling:evidence.autoscaling===true,loadRamp:evidence.loadRamp===true,faultInjection:evidence.faultInjection===true,matchMigration:evidence.matchMigration===true,capacityCertification:evidence.capacityCertification===true,creatorReport:evidence.creatorReport===true};return Object.freeze({score:Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100),internalReady:Object.values(checks).every(Boolean),checks:Object.freeze(checks),productionReady:false,truthRule:MOBA_RESILIENCE_ORCHESTRATOR_V5.truthRule});}
