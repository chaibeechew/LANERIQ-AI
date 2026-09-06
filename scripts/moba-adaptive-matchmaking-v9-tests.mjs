import assert from "node:assert/strict";
import {MOBA_ADAPTIVE_MATCHMAKING_V9,buildMobaSearchEnvelope,chooseMobaMatchRegion,evaluateMobaAdaptiveMatchmakingV9,evaluateMobaMatchCandidate,selectMobaAdaptiveMatch} from "../lib/game/moba-adaptive-matchmaking-v9.js";

assert.equal(MOBA_ADAPTIVE_MATCHMAKING_V9.noPartySplit,true);
assert.equal(MOBA_ADAPTIVE_MATCHMAKING_V9.rankedFailClosed,true);
const early=buildMobaSearchEnvelope({mode:"ranked",queueAgeSeconds:10}),late=buildMobaSearchEnvelope({mode:"ranked",queueAgeSeconds:190});
assert.ok(late.maxTeamMmrDelta>early.maxTeamMmrDelta);assert.ok(late.maxIndividualMmrSpread>early.maxIndividualMmrSpread);assert.ok(late.maxPlayerLatencyMs>early.maxPlayerLatencyMs);assert.equal(late.wideningApplied,true);

const roles=["vanguard","fighter","mage","marksman","support"];
function player(i,{mmr=1000,partyId=null,queuedAtMs=0,ap=45,us=190,eligible=true}={}){return{playerId:`p${i}`,partyId:partyId||`solo-${i}`,mmr,mmrUncertainty:70,preferredRoles:[roles[(i-1)%5]],queuedAtMs,verified:true,rankedEligible:eligible,latencyByRegion:{"ap-southeast":ap,"us-west":us}};}
const tickets=[
  player(1,{mmr:990,partyId:"party-a",ap:42}),player(2,{mmr:1010,partyId:"party-a",ap:48}),
  player(3,{mmr:995,partyId:"party-b",ap:50}),player(4,{mmr:1005,partyId:"party-b",ap:46}),
  player(5,{mmr:1000,partyId:"solo-5",ap:44}),
  player(6,{mmr:992,partyId:"party-c",ap:52}),player(7,{mmr:1008,partyId:"party-c",ap:55}),
  player(8,{mmr:997,partyId:"party-d",ap:49}),player(9,{mmr:1003,partyId:"party-d",ap:51}),
  player(10,{mmr:1001,partyId:"solo-10",ap:47}),
];
const region=chooseMobaMatchRegion({tickets,preferredRegion:"auto"});assert.equal(region.ok,true);assert.equal(region.region,"ap-southeast");assert.ok(region.p95LatencyMs<100);
const candidate=evaluateMobaMatchCandidate({tickets,mode:"ranked",nowMs:60000,preferredRegion:"ap-southeast"});
assert.equal(candidate.valid,true);assert.equal(candidate.partySplit,false);assert.equal(candidate.region,"ap-southeast");assert.ok(candidate.qualityScore>=60);assert.ok(candidate.teamMmrDelta<=candidate.envelope.maxTeamMmrDelta);assert.equal(candidate.teams.blue.length,5);assert.equal(candidate.teams.red.length,5);assert.equal(new Set(candidate.teams.blue.map(x=>x.role)).size,5);assert.equal(new Set(candidate.teams.red.map(x=>x.role)).size,5);
for(const partyId of ["party-a","party-b","party-c","party-d"]){const teams=new Set([...candidate.teams.blue,...candidate.teams.red].filter(x=>x.partyId===partyId).map(x=>x.team));assert.equal(teams.size,1,`${partyId} must never split across teams`);}

const ineligible=[...tickets.slice(0,9),player(10,{mmr:1001,eligible:false})];assert.equal(evaluateMobaMatchCandidate({tickets:ineligible,mode:"ranked",nowMs:60000}).reason,"ranked_eligibility_required");
const wide=tickets.map((p,i)=>({...p,partyId:`solo-wide-${i}`,mmr:i<5?700+i*5:1300+i*5,queuedAtMs:0}));const tooEarly=evaluateMobaMatchCandidate({tickets:wide,mode:"ranked",nowMs:10000});assert.equal(tooEarly.valid,false);assert.ok(["team_mmr_delta_too_high","individual_mmr_spread_too_high"].includes(tooEarly.reason));const widened=evaluateMobaMatchCandidate({tickets:wide,mode:"unranked",nowMs:360000});assert.equal(widened.valid,true);

const queue=[...tickets.map((p,i)=>({...p,playerId:`q${i+1}`,partyId:`q-solo-${i+1}`,queuedAtMs:i===0?0:30000})),player(11,{queuedAtMs:45000}),player(12,{queuedAtMs:45000})].map((p,i)=>({...p,verified:true,rankedEligible:true,latencyByRegion:{"ap-southeast":45+i,"us-west":180+i}}));
const selected=selectMobaAdaptiveMatch({tickets:queue,mode:"ranked",nowMs:90000,preferredRegion:"ap-southeast"});assert.equal(selected.matched,true);const chosenIds=new Set([...selected.teams.blue,...selected.teams.red].map(x=>x.playerId));assert.equal(chosenIds.has("q1"),true,"Oldest queued player must anchor adaptive search fairness.");assert.ok(selected.searchedCandidates>0);

const v9=evaluateMobaAdaptiveMatchmakingV9({queueWidening:true,mmrBalance:true,partyIntegrity:true,roleAssignment:true,regionRouting:true,queueFairness:true,rankedEligibility:true,qualityScore:true});assert.equal(v9.score,100);assert.equal(v9.internalReady,true);assert.equal(v9.productionReady,false);
console.log("✓ MOBA Adaptive Matchmaking V9 passed: queue widening, MMR balance, no party split, role assignment, latency-aware region routing, oldest-player fairness, Ranked eligibility and match quality scoring.");
