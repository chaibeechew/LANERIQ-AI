import assert from "node:assert/strict";
import {MOBA_RESILIENCE_ORCHESTRATOR_V5,buildMobaCreatorCapacityReport,buildMobaLoadRampPlan,calculateMobaAutoscalePlan,createMobaFaultInjectionCampaign,evaluateMobaCapacityCertification,evaluateMobaFaultCampaign,evaluateMobaResilienceV5,planMobaMatchMigration,planMobaRegionalPlacement,validateMobaMigrationHandoff} from "../lib/game/moba-resilience-orchestrator-v5.js";

assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.providerNeutral,true);
assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.dedicatedLanerIqServerRequired,false);
assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.zeroTouchCreatorExperience,true);

const providers=[
  {id:"ap-a",connected:true,healthy:true,commercialUseAllowed:true,regions:["ap-southeast"],maxConcurrentMatches:80,currentConcurrentMatches:10,latencyByRegion:{"ap-southeast":42}},
  {id:"ap-b",connected:true,healthy:true,commercialUseAllowed:true,regions:["ap-southeast","us-west"],maxConcurrentMatches:100,currentConcurrentMatches:10,latencyByRegion:{"ap-southeast":65,"us-west":85}},
  {id:"us-a",connected:true,healthy:true,commercialUseAllowed:true,regions:["us-west"],maxConcurrentMatches:90,currentConcurrentMatches:5,latencyByRegion:{"us-west":38}},
  {id:"bad",connected:true,healthy:false,regions:["ap-southeast"],maxConcurrentMatches:1000,currentConcurrentMatches:0}
];
const placement=planMobaRegionalPlacement({demandByRegion:{"ap-southeast":100,"us-west":50},providers,reserveRatio:.2});
assert.equal(placement.fullyPlaced,true);assert.equal(placement.unplaced.length,0);assert.ok(placement.placements.some(p=>p.providerId==="ap-a"));assert.ok(placement.placements.some(p=>p.providerId==="us-a"));assert.equal(placement.placements.some(p=>p.providerId==="bad"),false);assert.equal(placement.providerCredentialExposed,false);
const insufficient=planMobaRegionalPlacement({demandByRegion:{"ap-southeast":500},providers,reserveRatio:.2});assert.equal(insufficient.fullyPlaced,false);assert.ok(insufficient.unplaced[0].matches>0);

const scaleOut=calculateMobaAutoscalePlan({activeMatches:70,queuedMatches:20,readyHosts:8,hostMatchCapacity:10,targetUtilization:.7,minWarmHosts:2});assert.equal(scaleOut.direction,"scale_out");assert.ok(scaleOut.desiredHosts>8);assert.equal(scaleOut.productionActionExecuted,false);
const scaleIn=calculateMobaAutoscalePlan({activeMatches:10,queuedMatches:0,readyHosts:20,hostMatchCapacity:10,targetUtilization:.7,minWarmHosts:2});assert.equal(scaleIn.direction,"scale_in");assert.equal(scaleIn.scaleInRequiresDrain,true);

const ramp=buildMobaLoadRampPlan({targetConcurrentPlayers:5000,rampMinutes:20,holdMinutes:45,steps:5});assert.equal(ramp.targetConcurrentMatches,500);assert.equal(ramp.stages.length,5);assert.equal(ramp.stages.at(-1).concurrentPlayers,5000);assert.equal(ramp.executionMode,"plan_only");

const campaign=createMobaFaultInjectionCampaign({regions:["ap-southeast","us-west"]});assert.ok(campaign.scenarios.some(x=>x.id==="authoritative-host-crash"));assert.ok(campaign.scenarios.some(x=>x.kind==="region"));assert.equal(campaign.productionTrafficTargeted,false);
const faultResults=campaign.scenarios.map(s=>({id:s.id,splitBrain:false,sequenceMonotonic:true,resyncRecovered:true,resultCorrupted:false,recoveryMs:s.kind==="region"?12000:2500}));const faults=evaluateMobaFaultCampaign(faultResults);assert.equal(faults.passed,true);assert.equal(faults.productionEvidence,false);
const brokenFaults=evaluateMobaFaultCampaign([{id:"packet-loss-5pct",splitBrain:true,sequenceMonotonic:true,resyncRecovered:true,resultCorrupted:false,recoveryMs:1000}]);assert.equal(brokenFaults.passed,false);

const migration=planMobaMatchMigration({matchId:"m-1",sourceHostId:"host-a",sourceRegion:"ap-southeast",snapshotVersion:44,serverSequence:1200,candidates:[{hostId:"host-b",region:"ap-southeast",healthy:true,availableMatchSlots:2,latencyMs:40},{hostId:"host-c",region:"us-west",healthy:true,availableMatchSlots:20,latencyMs:90}]});assert.equal(migration.ok,true);assert.equal(migration.targetHostId,"host-b");assert.ok(migration.steps.includes("verify-sequence-continuity"));
const handoff=validateMobaMigrationHandoff({plan:migration,sourceFinal:{matchId:"m-1",snapshotVersion:45,serverSequence:1210},targetRestored:{matchId:"m-1",snapshotVersion:45,serverSequence:1210,authoritative:true},sourceStopped:true});assert.equal(handoff.ok,true);assert.equal(handoff.splitBrainPrevented,true);
const splitBrain=validateMobaMigrationHandoff({plan:migration,sourceFinal:{matchId:"m-1",snapshotVersion:45,serverSequence:1210},targetRestored:{matchId:"m-1",snapshotVersion:45,serverSequence:1210,authoritative:true},sourceStopped:false});assert.equal(splitBrain.ok,false);

const simulation={capacityKnown:true,targetConcurrentPlayers:5000,modeledStablePlayers:6000};
const simulationOnly=evaluateMobaCapacityCertification({targetConcurrentPlayers:5000,simulation});assert.equal(simulationOnly.level,"simulation_only");assert.equal(simulationOnly.capacityClaimAllowed,false);assert.equal(simulationOnly.zeroCrashGuarantee,false);
const measuredLoad={concurrentPlayers:5000,durationMinutes:45,serverTickP95Ms:28,serverTickP99Ms:43,latencyP95Ms:145,packetLossPct:.8,reconnectSuccessRate:.997,crashRatePct:.01,errorRatePct:.2};
const preview=evaluateMobaCapacityCertification({targetConcurrentPlayers:5000,simulation,measuredLoad});assert.equal(preview.level,"measured_preview");assert.equal(preview.capacityClaimAllowed,false);
const certified=evaluateMobaCapacityCertification({targetConcurrentPlayers:5000,simulation,measuredLoad,soak:{durationMinutes:180,uncaughtExceptions:0,integrityViolations:0,crashRatePct:.01},failover:{tested:true,recoveryMs:8000,lostAuthoritativeEvents:0,splitBrain:false,resultIntegrity:true},devices:{ios:true,android:true}});assert.equal(certified.level,"production_certified");assert.equal(certified.verifiedConcurrentPlayers,5000);assert.equal(certified.capacityClaimAllowed,true);assert.equal(certified.stabilityVerified,true);assert.equal(certified.zeroCrashGuarantee,false);assert.equal(certified.zeroBugGuarantee,false);
const report=buildMobaCreatorCapacityReport({certification:certified,simulation});assert.match(report.headline,/5,000 concurrent players/);assert.equal(report.creatorNeedsServerExpertise,false);assert.equal(report.providerDetailsHidden,true);assert.equal(report.showCrashFreeBadge,false);

const v5=evaluateMobaResilienceV5({regionalPlacement:true,autoscaling:true,loadRamp:true,faultInjection:true,matchMigration:true,capacityCertification:true,creatorReport:true});assert.equal(v5.score,100);assert.equal(v5.internalReady,true);assert.equal(v5.productionReady,false);
console.log("✓ MOBA Resilience V5 passed: multi-region placement, autoscaling, load ramp, fault injection, authoritative migration, strict capacity certification and creator-safe reporting.");
