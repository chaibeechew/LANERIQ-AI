import assert from "node:assert/strict";
import {simulateMobaCapacity} from "../lib/game/moba-network-autopilot-v1.js";
import {MOBA_RESILIENCE_ORCHESTRATOR_V5,buildMobaCreatorCapacityReport,buildMobaLoadRampPlan,calculateMobaAutoscalePlan,createMobaFaultInjectionCampaign,evaluateMobaCapacityCertification,evaluateMobaFaultCampaign,evaluateMobaResilienceV5,planMobaMatchMigration,planMobaRegionalPlacement,validateMobaMigrationHandoff} from "../lib/game/moba-resilience-orchestrator-v5.js";

assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.providerNeutral,true);
assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.dedicatedLanerIqServerRequired,false);
assert.equal(MOBA_RESILIENCE_ORCHESTRATOR_V5.zeroTouchCreatorExperience,true);

const providers=[
  {id:"ap-a",connected:true,healthy:true,commercialUseAllowed:true,regions:["ap-southeast"],latencyByRegion:{"ap-southeast":35},maxConcurrentMatches:100,currentConcurrentMatches:10},
  {id:"ap-b",connected:true,healthy:true,commercialUseAllowed:true,regions:["ap-southeast","us-west"],latencyByRegion:{"ap-southeast":55,"us-west":80},maxConcurrentMatches:100,currentConcurrentMatches:5},
  {id:"us-a",connected:true,healthy:true,commercialUseAllowed:true,regions:["us-west"],latencyByRegion:{"us-west":30},maxConcurrentMatches:80,currentConcurrentMatches:0}
];
const placement=planMobaRegionalPlacement({demandByRegion:{"ap-southeast":60,"us-west":40},providers,reserveRatio:.2});
assert.equal(placement.fullyPlaced,true);assert.equal(placement.unplaced.length,0);assert.equal(placement.providerCredentialExposed,false);assert.equal(placement.productionEvidenceVerified,false);assert.equal(placement.placements.reduce((sum,row)=>sum+row.matches,0),100);
const overPlacement=planMobaRegionalPlacement({demandByRegion:{"ap-southeast":500},providers,reserveRatio:.2});assert.equal(overPlacement.fullyPlaced,false);assert.ok(overPlacement.unplaced[0].matches>0);

const scaleOut=calculateMobaAutoscalePlan({activeMatches:100,queuedMatches:20,readyHosts:8,hostMatchCapacity:10});assert.equal(scaleOut.direction,"scale_out");assert.ok(scaleOut.desiredHosts>8);assert.equal(scaleOut.productionActionExecuted,false);
const holdOrIn=calculateMobaAutoscalePlan({activeMatches:5,queuedMatches:0,readyHosts:20,hostMatchCapacity:10});assert.equal(holdOrIn.direction,"scale_in");assert.equal(holdOrIn.scaleInRequiresDrain,true);

const ramp=buildMobaLoadRampPlan({targetConcurrentPlayers:1000,rampMinutes:10,holdMinutes:30,steps:5});assert.equal(ramp.targetConcurrentMatches,100);assert.equal(ramp.stages.length,5);assert.equal(ramp.stages.at(-1).concurrentPlayers,1000);assert.equal(ramp.executionMode,"plan_only");
const campaign=createMobaFaultInjectionCampaign({regions:["ap-southeast","us-west"]});assert.ok(campaign.scenarios.some(item=>item.id==="authoritative-host-crash"));assert.ok(campaign.scenarios.some(item=>item.kind==="region"));assert.equal(campaign.productionTrafficTargeted,false);
const syntheticFaultResults=campaign.scenarios.map(item=>({id:item.id,splitBrain:false,sequenceMonotonic:true,resyncRecovered:true,resultCorrupted:false,recoveryMs:5000}));const faultEval=evaluateMobaFaultCampaign(syntheticFaultResults);assert.equal(faultEval.passed,true);assert.equal(faultEval.productionEvidence,false);
const corruptFault=evaluateMobaFaultCampaign(syntheticFaultResults.map((item,index)=>index===0?{...item,resultCorrupted:true}:item));assert.equal(corruptFault.passed,false);

const migration=planMobaMatchMigration({matchId:"match-77",sourceHostId:"host-a",sourceRegion:"ap-southeast",snapshotVersion:42,serverSequence:900,candidates:[{hostId:"host-b",region:"ap-southeast",healthy:true,availableMatchSlots:1,latencyMs:20},{hostId:"host-c",region:"us-west",healthy:true,availableMatchSlots:2,latencyMs:80}]});assert.equal(migration.ok,true);assert.equal(migration.targetHostId,"host-b");assert.equal(migration.productionActionExecuted,false);assert.ok(migration.steps.includes("verify-sequence-continuity"));assert.ok(migration.steps.includes("drain-source"));
const handoff=validateMobaMigrationHandoff({plan:migration,sourceFinal:{matchId:"match-77",snapshotVersion:44,serverSequence:920},targetRestored:{matchId:"match-77",snapshotVersion:44,serverSequence:920,authoritative:true},sourceStopped:true});assert.equal(handoff.ok,true);assert.equal(handoff.splitBrainPrevented,true);
const splitBrain=validateMobaMigrationHandoff({plan:migration,sourceFinal:{matchId:"match-77",snapshotVersion:44,serverSequence:920},targetRestored:{matchId:"match-77",snapshotVersion:44,serverSequence:920,authoritative:true},sourceStopped:false});assert.equal(splitBrain.ok,false);assert.equal(splitBrain.splitBrainPrevented,false);
const missingContinuity=validateMobaMigrationHandoff({plan:migration,sourceFinal:{matchId:"match-77"},targetRestored:{matchId:"match-77",authoritative:true},sourceStopped:true});assert.equal(missingContinuity.ok,false,"Missing snapshot/sequence continuity evidence must fail closed.");

const providerModel={maxConcurrentPlayers:2000,maxConcurrentMatches:220,maxAuthoritativeTicksPerSecond:5000,maxEgressMbps:100,latencyMs:60,jitterMs:8,packetLossPct:.2};
const simulation=simulateMobaCapacity({provider:providerModel,targetConcurrentPlayers:1000});
const simulationOnly=evaluateMobaCapacityCertification({targetConcurrentPlayers:1000,simulation});assert.equal(simulationOnly.level,"simulation_only");assert.equal(simulationOnly.capacityClaimAllowed,false);assert.equal(simulationOnly.zeroCrashGuarantee,false);assert.equal(simulationOnly.zeroBugGuarantee,false);
const measuredLoad={concurrentPlayers:1000,durationMinutes:45,serverTickP95Ms:30,serverTickP99Ms:44,latencyP95Ms:150,packetLossPct:1,reconnectSuccessRate:.995,crashRatePct:.05,errorRatePct:.2};
const measuredPreview=evaluateMobaCapacityCertification({targetConcurrentPlayers:1000,simulation,measuredLoad});assert.equal(measuredPreview.level,"measured_preview");assert.equal(measuredPreview.capacityClaimAllowed,false);
const certified=evaluateMobaCapacityCertification({targetConcurrentPlayers:1000,simulation,measuredLoad,soak:{durationMinutes:180,uncaughtExceptions:0,integrityViolations:0,crashRatePct:.02},failover:{tested:true,recoveryMs:8000,lostAuthoritativeEvents:0,splitBrain:false,resultIntegrity:true},devices:{ios:true,android:true}});assert.equal(certified.level,"production_certified");assert.equal(certified.verifiedConcurrentPlayers,1000);assert.equal(certified.capacityClaimAllowed,true);assert.equal(certified.stabilityVerified,true);assert.equal(certified.zeroCrashGuarantee,false);assert.equal(certified.zeroBugGuarantee,false);
const creatorReport=buildMobaCreatorCapacityReport({certification:simulationOnly,simulation});assert.equal(creatorReport.creatorNeedsServerExpertise,false);assert.equal(creatorReport.providerDetailsHidden,true);assert.equal(creatorReport.showCrashFreeBadge,false);assert.match(creatorReport.headline,/Simulation estimates/i);

const v5=evaluateMobaResilienceV5({regionalPlacement:true,autoscaling:true,loadRamp:true,faultInjection:true,matchMigration:true,capacityCertification:true,creatorReport:true});assert.equal(v5.internalReady,true);assert.equal(v5.score,100);assert.equal(v5.productionReady,false);
console.log("✓ MOBA Resilience V5: multi-region placement, autoscaling, load ramp, fault injection, migration/split-brain safety and capacity certification/reporting contracts passed.");
