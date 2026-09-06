import assert from "node:assert/strict";
import {MOBA_NETWORK_AUTOPILOT_V1,evaluateMobaNetworkAutopilotEvidence,planMobaNetworkAutopilot,simulateMobaCapacity} from "../lib/game/moba-network-autopilot-v1.js";
import {MOBA_COMPETITIVE_NETWORK_V4,acknowledgeMobaNetworkResync,buildMobaDeltaSnapshot,calculateMobaLagCompensation,calculateMobaRankedMmr,castMobaMatchVote,createMobaCompetitiveNetworkAuthority,createMobaMatchGovernance,evaluateMobaCompetitiveNetworkV4,evaluateMobaHeartbeat,finalizeMobaAuthoritativeMatchResult,heartbeatMobaPlayer,ingestMobaNetworkPacket,markMobaEarlyDisconnect,observeMobaPlayerInput,recordMobaRewindFrame,recoverMobaPacketGap,updateMobaAfkBotTakeover,validateMobaRewindSkillshot} from "../lib/game/moba-competitive-network-v4.js";

const completeCaps={relay:true,matchmaking:true,authoritativeHost:true,reconnect:true,snapshotDelta:true,heartbeat:true,regionalFailover:true,tickRate:30,regions:["ap-southeast","us-west"]};
const providers=[
  {id:"provider-a",connected:true,healthy:true,commercialUseAllowed:true,capabilities:completeCaps,latencyMs:62,jitterMs:8,packetLossPct:.2,reliabilityScore:99,exitReadinessScore:90,maxConcurrentPlayers:2000,maxConcurrentMatches:220,maxAuthoritativeTicksPerSecond:5000,maxEgressMbps:100,estimatedHourlyCostUsd:0},
  {id:"provider-b",connected:true,healthy:true,commercialUseAllowed:true,capabilities:{...completeCaps,regionalFailover:false},latencyMs:90,jitterMs:15,packetLossPct:.5,reliabilityScore:95,exitReadinessScore:80,maxConcurrentPlayers:1500,maxConcurrentMatches:160,maxAuthoritativeTicksPerSecond:3500,maxEgressMbps:70,estimatedHourlyCostUsd:0},
  {id:"provider-bad",connected:true,healthy:true,commercialUseAllowed:true,capabilities:{relay:true,matchmaking:true,tickRate:20,regions:["ap-southeast"]},maxConcurrentPlayers:5000,estimatedHourlyCostUsd:0}
];

assert.equal(MOBA_NETWORK_AUTOPILOT_V1.dedicatedLanerIqServerRequired,false);
const autopilot=planMobaNetworkAutopilot({expectedConcurrentPlayers:1000,region:"ap-southeast",providers});
assert.equal(autopilot.decision,"connect");assert.equal(autopilot.providerId,"provider-a");assert.ok(autopilot.fallbackProviderIds.includes("provider-b"));assert.equal(autopilot.credentialsExposedToGameCreator,false);assert.ok(autopilot.rejected.some(item=>item.providerId==="provider-bad"&&item.reason.startsWith("missing_capability:")));
const fallback=planMobaNetworkAutopilot({expectedConcurrentPlayers:1000,region:"ap-southeast",providers:[]});assert.equal(fallback.decision,"simulate");assert.equal(fallback.providerId,null);
const capacity=simulateMobaCapacity({provider:providers[0],targetConcurrentPlayers:1000});assert.equal(capacity.capacityKnown,true);assert.ok(capacity.modeledStablePlayers>=1000);assert.equal(capacity.smoothnessGrade,"modeled_smooth");assert.equal(capacity.liveCapacityClaimAllowed,false);assert.equal(capacity.crashFreeClaimAllowed,false);
const overCapacity=simulateMobaCapacity({provider:providers[0],targetConcurrentPlayers:2100});assert.equal(overCapacity.smoothnessGrade,"modeled_over_capacity");
const autopilotEvidence=evaluateMobaNetworkAutopilotEvidence({providerSelection:true,providerOpaque:true,capacitySimulation:true,automaticFallback:true,costPolicy:true,regionPolicy:true});assert.equal(autopilotEvidence.internalReady,true);assert.equal(autopilotEvidence.productionReady,false);

const players=Array.from({length:10},(_,i)=>({playerId:`p${i+1}`,team:i<5?"blue":"red",heroId:i<5?`blue-${i+1}`:`red-${i-4}`}));
const authority=createMobaCompetitiveNetworkAuthority({players,startedAtMs:0});
assert.equal(MOBA_COMPETITIVE_NETWORK_V4.maxRewindMs,220);
assert.equal(heartbeatMobaPlayer(authority,{playerId:"p1",nowMs:1000,rttMs:180,jitterMs:20}).ok,true);
assert.equal(evaluateMobaHeartbeat(authority,{playerId:"p1",nowMs:3500}).status,"connected");
assert.equal(evaluateMobaHeartbeat(authority,{playerId:"p1",nowMs:5000}).status,"degraded");
assert.equal(evaluateMobaHeartbeat(authority,{playerId:"p1",nowMs:8000}).status,"disconnected");
const lag=calculateMobaLagCompensation({rttMs:180,jitterMs:20});assert.ok(lag.rewindMs>0&&lag.rewindMs<=MOBA_COMPETITIVE_NETWORK_V4.maxRewindMs);

const prev={version:1,tick:10,time:.5,eventSequence:1,heroes:[{id:"blue-1",health:1000,x:100,y:100},{id:"red-1",health:1000,x:200,y:100}],structures:{blueCore:{health:3500},redCore:{health:3500},towers:[{id:"red-t1",health:1800}]}};
const next={version:2,tick:11,time:.55,eventSequence:2,heroes:[{id:"blue-1",health:1000,x:105,y:100},{id:"red-1",health:900,x:200,y:100}],structures:{blueCore:{health:3500},redCore:{health:3500},towers:[{id:"red-t1",health:1700}]}};
const delta=buildMobaDeltaSnapshot(prev,next);assert.equal(delta.baseSnapshotVersion,1);assert.equal(delta.snapshotVersion,2);assert.equal(delta.heroes.length,2);assert.equal(delta.structures.towers.length,1);

recordMobaRewindFrame(authority,{serverNowMs:900,tick:18,heroes:[{id:"blue-1",team:"blue",x:100,y:100,dead:false},{id:"red-1",team:"red",x:200,y:100,dead:false},{id:"red-2",team:"red",x:260,y:160,dead:false}]});
recordMobaRewindFrame(authority,{serverNowMs:1000,tick:20,heroes:[{id:"blue-1",team:"blue",x:100,y:100,dead:false},{id:"red-1",team:"red",x:340,y:100,dead:false},{id:"red-2",team:"red",x:260,y:160,dead:false}]});
const rewind=validateMobaRewindSkillshot(authority,{sourceId:"blue-1",sourceTeam:"blue",serverNowMs:1000,rttMs:200,jitterMs:0,aimX:1,aimY:0,range:260,radius:24});assert.equal(rewind.ok,true);assert.equal(rewind.rewindTick,18);assert.equal(rewind.hitId,"red-1");assert.equal(rewind.serverOwned,true);

const packet2=ingestMobaNetworkPacket(authority,{playerId:"p2",sequence:2,payload:"two",nowMs:10});assert.equal(packet2.buffered,true);
const packet1=ingestMobaNetworkPacket(authority,{playerId:"p2",sequence:1,payload:"one",nowMs:20});assert.deepEqual(packet1.delivered.map(item=>item.sequence),[1,2]);
const duplicate=ingestMobaNetworkPacket(authority,{playerId:"p2",sequence:1,payload:"again",nowMs:30});assert.equal(duplicate.duplicate,true);
const packet4=ingestMobaNetworkPacket(authority,{playerId:"p2",sequence:4,payload:"four",nowMs:40});assert.equal(packet4.buffered,true);
const recovered=recoverMobaPacketGap(authority,{playerId:"p2",nowMs:300});assert.equal(recovered.lost,1);assert.deepEqual(recovered.delivered.map(item=>item.sequence),[4]);assert.equal(recovered.resyncRequired,true);

observeMobaPlayerInput(authority,{playerId:"p3",nowMs:0});const takeover=updateMobaAfkBotTakeover(authority,{playerId:"p3",nowMs:13000});assert.equal(takeover.botControlled,true);assert.equal(takeover.reason,"afk");const released=acknowledgeMobaNetworkResync(authority,{playerId:"p3",nowMs:13100});assert.equal(released.inputUnlocked,true);assert.equal(authority.clients.get("p3").botControlled,false);

const remakeGov=createMobaMatchGovernance({matchId:"match-remake",players,startedAtMs:0});assert.equal(markMobaEarlyDisconnect(remakeGov,{playerId:"p1",nowMs:30000}).eligible,true);for(const id of ["p2","p3","p4"])assert.equal(castMobaMatchVote(remakeGov,{type:"remake",playerId:id,nowMs:40000}).passed,false);assert.equal(castMobaMatchVote(remakeGov,{type:"remake",playerId:"p5",nowMs:40000}).passed,true);
const surrenderGov=createMobaMatchGovernance({matchId:"match-surrender",players,startedAtMs:0});for(const id of ["p6","p7","p8"])assert.equal(castMobaMatchVote(surrenderGov,{type:"surrender",playerId:id,nowMs:500000}).passed,false);assert.equal(castMobaMatchVote(surrenderGov,{type:"surrender",playerId:"p9",nowMs:500000}).passed,true);

const result=finalizeMobaAuthoritativeMatchResult({matchId:"match-ranked",matchState:{winner:"blue"},players,integrityPassed:true,endedAtMs:900000});assert.equal(result.ok,true);assert.equal(result.authoritative,true);assert.equal(result.rankedEligible,true);assert.equal(result.clientResultTrusted,false);assert.match(result.resultDigest,/^[a-f0-9]{64}$/);
const ratings=Object.fromEntries(players.map(p=>[p.playerId,1000]));const mmr=calculateMobaRankedMmr({result,ratings});assert.equal(mmr.ok,true);assert.ok(mmr.changes.p1.delta>0);assert.ok(mmr.changes.p6.delta<0);assert.equal(mmr.performanceStatFarmingAllowed,false);assert.equal(mmr.sourceDigest,result.resultDigest);
const remakeResult=finalizeMobaAuthoritativeMatchResult({matchId:"match-remake",matchState:{winner:null},players,integrityPassed:true,remake:true,reason:"remake",endedAtMs:120000});assert.equal(remakeResult.rankedEligible,false);assert.equal(calculateMobaRankedMmr({result:remakeResult,ratings}).ok,false);

const v4=evaluateMobaCompetitiveNetworkV4({deltaSnapshot:true,heartbeat:true,lagCompensation:true,serverRewind:true,packetRecovery:true,afkBot:true,surrenderRemake:true,matchResultAuthority:true,mmrIntegrity:true});assert.equal(v4.passed,true);assert.equal(v4.score,100);assert.equal(v4.productionReady,false);

console.log("✓ MOBA Network Autopilot + Competitive Network V4: provider auto-routing, synthetic capacity modeling, delta snapshots, heartbeat, lag compensation, server rewind, packet recovery, AFK bot takeover, surrender/remake, authoritative results and MMR integrity passed.");
