import assert from "node:assert/strict";
import {MOBA_MATCH_FABRIC_SUPERVISOR_V6,createMobaAuthoritativeAudit,createMobaCircuitBreaker,createMobaHealthHysteresis,evaluateMobaAdmission,evaluateMobaCircuitBreaker,evaluateMobaFabricV6,observeMobaProviderHealth,planMobaHostDrain,planMobaRollingUpgrade,recordMobaProviderFailure,recordMobaProviderSuccess,validateMobaProtocolCompatibility} from "../lib/game/moba-match-fabric-supervisor-v6.js";

assert.equal(MOBA_MATCH_FABRIC_SUPERVISOR_V6.providerNeutral,true);
assert.equal(MOBA_MATCH_FABRIC_SUPERVISOR_V6.dedicatedLanerIqServerRequired,false);

const rankedBlocked=evaluateMobaAdmission({mode:"ranked",authoritativeAvailable:false,relayAvailable:false,matchmakingAvailable:false,providerHealthy:false,creatorPreview:true});
assert.equal(rankedBlocked.allowed,false);assert.equal(rankedBlocked.rankedFailClosed,true);assert.equal(rankedBlocked.reason,"ranked_live_authority_required");
const preview=evaluateMobaAdmission({mode:"5v5",creatorPreview:true});assert.equal(preview.allowed,true);assert.equal(preview.fallback,"bot_training");
const live=evaluateMobaAdmission({mode:"ranked",readyMatchSlots:4,authoritativeAvailable:true,relayAvailable:true,matchmakingAvailable:true,providerHealthy:true});assert.equal(live.allowed,true);assert.equal(live.reason,"capacity_ready");
const waitBlocked=evaluateMobaAdmission({mode:"5v5",estimatedWaitSeconds:121,authoritativeAvailable:true,relayAvailable:true,matchmakingAvailable:true,providerHealthy:true});assert.equal(waitBlocked.allowed,false);assert.equal(waitBlocked.reason,"queue_wait_budget_exceeded");
const pressure=evaluateMobaAdmission({mode:"5v5",queuedMatches:100,readyMatchSlots:0,authoritativeAvailable:true,relayAvailable:true,matchmakingAvailable:true,providerHealthy:true});assert.equal(pressure.allowed,false);assert.equal(pressure.reason,"backpressure_capacity_exhausted");

const breaker=createMobaCircuitBreaker({providerId:"p1",nowMs:0});recordMobaProviderFailure(breaker,{nowMs:1});recordMobaProviderFailure(breaker,{nowMs:2});assert.equal(breaker.state,"closed");recordMobaProviderFailure(breaker,{nowMs:3});assert.equal(breaker.state,"open");assert.equal(evaluateMobaCircuitBreaker(breaker,{nowMs:20000}).allowed,false);const half=evaluateMobaCircuitBreaker(breaker,{nowMs:30003});assert.equal(half.state,"half_open");assert.equal(half.allowed,true);recordMobaProviderSuccess(breaker,{nowMs:30004});assert.equal(breaker.state,"half_open");assert.equal(breaker.probeAllowed,true);recordMobaProviderSuccess(breaker,{nowMs:30005});assert.equal(breaker.state,"closed");assert.equal(breaker.failures,0);

const health=createMobaHealthHysteresis({providerId:"p1"});assert.equal(observeMobaProviderHealth(health,{healthy:true}).eligible,false);assert.equal(observeMobaProviderHealth(health,{healthy:true}).eligible,false);assert.equal(observeMobaProviderHealth(health,{healthy:true}).eligible,true);assert.equal(observeMobaProviderHealth(health,{healthy:false}).eligible,true);assert.equal(observeMobaProviderHealth(health,{healthy:false}).eligible,false);

const emptyDrain=planMobaHostDrain({hostId:"h1",currentMatches:0});assert.equal(emptyDrain.mode,"safe_to_stop");assert.deepEqual(emptyDrain.steps,["stop_host"]);
const migrateDrain=planMobaHostDrain({hostId:"h2",currentMatches:5,migrationAvailable:true});assert.equal(migrateDrain.mode,"drain_then_migrate");assert.ok(migrateDrain.steps.includes("migrate_remaining_matches"));assert.equal(migrateDrain.acceptNewMatches,false);

const hosts=Array.from({length:20},(_,i)=>({hostId:`h-${String(i+1).padStart(2,"0")}`,healthy:true,currentMatches:i%5}));const upgrade=planMobaRollingUpgrade({hosts,canaryPercent:10,targetVersion:"v-next"});assert.equal(upgrade.totalHosts,20);assert.equal(upgrade.canaryHosts.length,2);assert.equal(upgrade.rankedTrafficOnCanary,false);assert.equal(upgrade.requiresCanaryEvidenceBeforeExpansion,true);

const compatible=validateMobaProtocolCompatibility({serverProtocol:1,clientProtocol:1,serverBuild:"server-a",clientBuild:"ios-a",snapshotSchema:2,clientSnapshotSchema:2});assert.equal(compatible.compatible,true);const incompatible=validateMobaProtocolCompatibility({serverProtocol:1,clientProtocol:1,serverBuild:"server-a",clientBuild:"ios-a",snapshotSchema:2,clientSnapshotSchema:1});assert.equal(incompatible.compatible,false);

const participants=[{playerId:"p2",team:"blue",heroId:"b2"},{playerId:"p1",team:"blue",heroId:"b1"},{playerId:"p6",team:"red",heroId:"r1"}];const audit1=createMobaAuthoritativeAudit({matchId:"m1",serverSequence:400,snapshotVersion:30,winner:"blue",participants,resultDigest:"result",eventsDigest:"events"});const audit2=createMobaAuthoritativeAudit({matchId:"m1",serverSequence:400,snapshotVersion:30,winner:"blue",participants:[...participants].reverse(),resultDigest:"result",eventsDigest:"events"});assert.match(audit1.auditDigest,/^[a-f0-9]{64}$/);assert.equal(audit1.auditDigest,audit2.auditDigest);assert.equal(audit1.serverOwned,true);assert.equal(audit1.clientMutable,false);

const v6=evaluateMobaFabricV6({admission:true,backpressure:true,circuitBreaker:true,hysteresis:true,hostDrain:true,rollingUpgrade:true,protocolCompatibility:true,auditDigest:true});assert.equal(v6.score,100);assert.equal(v6.internalReady,true);assert.equal(v6.productionReady,false);
console.log("✓ MOBA Match Fabric V6 passed: ranked fail-closed, admission/backpressure, provider circuit breaker, health hysteresis, safe drain/upgrade, protocol gate and authoritative audit digest.");
