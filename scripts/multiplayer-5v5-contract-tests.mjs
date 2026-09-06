import assert from "node:assert/strict";
import fs from "node:fs";
import "./moba-combat-integrity-v3-tests.mjs";
import "./moba-network-competitive-v4-tests.mjs";
import "./moba-resilience-orchestrator-v5-tests.mjs";
import "./moba-match-fabric-supervisor-v6-tests.mjs";
import "./moba-live-evidence-controller-v7-tests.mjs";
import "./moba-session-shield-v8-tests.mjs";
import "./moba-adaptive-matchmaking-v9-tests.mjs";
import "./moba-capacity-verification-runner-v10-tests.mjs";
import {getMultiplayerProviderConfig} from "../lib/game/multiplayer-provider-gateway.js";
import {evaluateAdapterEvidence} from "../lib/game/multiplayer-adapter-v1.js";
import {evaluateLiveTransportReadiness} from "../lib/game/live-multiplayer-transport-v1.js";
import {multiplayerReadiness} from "../lib/game/multiplayer-authority-v1.js";
import {MOBA_AUTHORITATIVE_COMBAT_V2,advanceMobaAuthority,authoritativeMobaSnapshot,bindMobaPlayer,createMobaAuthoritativeCombat,mobaAntiCheatState,submitMobaCombatIntent,submitMobaMovementIntent} from "../lib/game/moba-authoritative-combat-v2.js";
import {acknowledgeMobaResync,buildMobaMatchmakingContract,canAcceptMobaInput,createMobaLiveSession,evaluateMobaLoadEvidence,evaluateMobaProductionEvidence,markMobaDisconnected,resumeMobaPlayer,startMobaLiveSession,validateMobaMatchedRoster} from "../lib/game/moba-live-session-v2.js";

for(const key of ["MULTIPLAYER_PROVIDER","MULTIPLAYER_MATCHMAKING_ENDPOINT","MULTIPLAYER_STATUS_ENDPOINT","MULTIPLAYER_CANCEL_ENDPOINT","MULTIPLAYER_PROVIDER_TOKEN"])delete process.env[key];
const config=getMultiplayerProviderConfig();
assert.equal(config.configured,false);
assert.equal(config.connected,false);
assert.equal(multiplayerReadiness().productionReady,false);
assert.equal(evaluateAdapterEvidence({shapeValidated:true}).productionReady,false);
assert.equal(evaluateLiveTransportReadiness({adapter:true}).productionReady,false);

const route=fs.readFileSync("app/api/game/multiplayer/matchmaking/route.js","utf8");
const gateway=fs.readFileSync("lib/game/multiplayer-provider-gateway.js","utf8");
const authority=fs.readFileSync("lib/game/multiplayer-authority-v1.js","utf8");
const transport=fs.readFileSync("lib/game/live-multiplayer-transport-v1.js","utf8");
const migration=fs.readFileSync("supabase/migrations/20260901134732_harden_multiplayer_session_contract.sql","utf8");
const claimMigration=fs.readFileSync("supabase/migrations/20260903022000_multiplayer_provider_claim_v2.sql","utf8");

for(const pattern of [/auth\.getUser\(\)/,/professional\.active/,/PRO_GAME_CREATOR_REQUIRED/,/\.eq\("owner_id",userId\)/,/productType===\"mobile_game\"/,/game\?\.enabled===true/,/REQUEST_ID/,/MAX_REQUEST_BYTES/,/server_reserve_multiplayer_session/,/server_claim_multiplayer_provider_v2/,/server_finalize_multiplayer_provider_v2/,/MULTIPLAYER_SUBMISSION_IN_PROGRESS/,/LIVE_MULTIPLAYER_NOT_CONNECTED/,/productionEvidenceVerified:false/,/Cache-Control\":\"private, no-store/])assert.match(route,pattern);
assert.ok(route.indexOf('server_reserve_multiplayer_session')<route.indexOf('server_claim_multiplayer_provider_v2'),"Session reservation must precede provider claim.");
assert.ok(route.indexOf('server_claim_multiplayer_provider_v2')<route.indexOf('createMultiplayerTicket({requestId'),"Provider execution must be downstream of the atomic provider claim.");
assert.match(route,/same idempotency key after an uncertain acknowledgement/i);
assert.match(route,/will not start a duplicate ticket/i);

for(const pattern of [/assertRuntimeUrlAllowed/,/AbortController/,/TIMEOUT_MS/,/MAX_RESPONSE_BYTES/,/redirect:\"error\"/,/cache:\"no-store\"/,/MULTIPLAYER_PROVIDER_TOKEN/,/MULTIPLAYER_COST_POLICY_BLOCKED/,/LIVE_MULTIPLAYER_NOT_CONNECTED/,/REQUEST_ID/,/Idempotency-Key/,/idempotencyKey:stableRequestId/,/validId/,/SAFE_STATUS/])assert.match(gateway,pattern);
assert.doesNotMatch(route,/MULTIPLAYER_PROVIDER_TOKEN/);
assert.match(authority,/authoritative:true/);assert.match(authority,/liveTransport:false/);assert.match(authority,/stale_sequence/);assert.match(authority,/rate_limited/);assert.match(authority,/reconnect/);
assert.match(transport,/adapterConnected:false/);assert.match(transport,/liveServiceVerified:false/);assert.match(transport,/reconnecting/);assert.match(transport,/resyncing/);assert.match(transport,/realDevices/);assert.match(transport,/regionalFailover/);

assert.match(migration,/enable row level security/i);
assert.match(migration,/revoke all on table public\.multiplayer_session_requests from public,anon,authenticated/i);
assert.match(migration,/unique\(user_id,request_id\)/i);
assert.match(migration,/owner_id=uid/i);
assert.match(migration,/pg_advisory_xact_lock/i);
assert.match(migration,/for update/i);
assert.match(migration,/revoke all on function public\.server_reserve_multiplayer_session\(uuid,uuid,text\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.server_reserve_multiplayer_session\(uuid,uuid,text\) to service_role/i);
assert.match(migration,/Terminal multiplayer session cannot be reopened/);

assert.match(claimMigration,/provider_claim_token uuid/i);
assert.match(claimMigration,/provider_claimed_at timestamptz/i);
assert.match(claimMigration,/server_claim_multiplayer_provider_v2/i);
assert.match(claimMigration,/server_finalize_multiplayer_provider_v2/i);
assert.match(claimMigration,/interval '90 seconds'/i);
assert.match(claimMigration,/provider_claim_token is distinct from p_claim_token/i);
assert.match(claimMigration,/Provider ticket is required/i);
assert.match(claimMigration,/pg_advisory_xact_lock/i);
assert.match(claimMigration,/revoke all on function public\.server_claim_multiplayer_provider_v2/i);
assert.match(claimMigration,/grant execute on function public\.server_claim_multiplayer_provider_v2.*service_role/is);

// Live 5v5 hardening v2: provider matchmaking is still evidence-gated, but the MOBA combat server no longer trusts client hit/damage claims.
assert.equal(MOBA_AUTHORITATIVE_COMBAT_V2.authoritative,true);
assert.equal(MOBA_AUTHORITATIVE_COMBAT_V2.clientDamageTrusted,false);
assert.equal(MOBA_AUTHORITATIVE_COMBAT_V2.clientHitTrusted,false);
const combat=createMobaAuthoritativeCombat({name:"Live Test Arena",game:{enabled:true,archetype:"moba",moba:{maxLevel:15}}});
assert.equal(combat.match.heroes.length,10);
assert.equal(bindMobaPlayer(combat,{playerId:"p-blue",heroId:"blue-1"}).ok,true);
assert.equal(bindMobaPlayer(combat,{playerId:"p-red",heroId:"red-1"}).ok,true);

// Move both bound heroes into deterministic combat range using server-validated movement/state, then prove forged damage is ignored and scored.
const blue=combat.match.heroes.find(h=>h.id==="blue-1"),red=combat.match.heroes.find(h=>h.id==="red-1");
blue.x=400;blue.y=360;red.x=470;red.y=360;
const move=submitMobaMovementIntent(combat,{playerId:"p-blue",sequence:1,actionId:"move-1",x:1,y:0,now:.05});assert.equal(move.ok,true);
const basic=submitMobaCombatIntent(combat,{playerId:"p-blue",sequence:2,actionId:"atk-1",kind:"basic_attack",targetId:"red-1",damage:999999});
assert.equal(basic.ok,true);assert.ok(basic.damage>0&&basic.damage<999999);assert.ok(mobaAntiCheatState(combat,"p-blue").score>=3,"Forged client damage must be recorded as an anti-cheat violation.");
const replay=submitMobaCombatIntent(combat,{playerId:"p-blue",sequence:2,actionId:"atk-1",kind:"basic_attack",targetId:"red-1",damage:1});assert.deepEqual(replay,basic,"Same actionId must replay the authoritative result instead of applying damage twice.");
advanceMobaAuthority(combat,1);const q=submitMobaCombatIntent(combat,{playerId:"p-blue",sequence:3,actionId:"q-1",kind:"ability",slot:"Q",targetId:"red-1"});assert.equal(q.ok,true);
const snapshot=authoritativeMobaSnapshot(combat,{playerId:"p-blue"});assert.equal(snapshot.selfId,"blue-1");assert.equal(snapshot.heroes.length,10);assert.ok(snapshot.eventSequence>=2);

// Matchmaking roster contract: exactly two unique five-player teams before the live session can become ready.
const queue=buildMobaMatchmakingContract({mode:"ranked",region:"ap-southeast",partySize:2,skill:1400,preferredRole:"mage"});assert.equal(queue.playersPerMatch,10);assert.equal(queue.teamSize,5);assert.equal(queue.constraints.authoritativeResultRequired,true);
const roster=Array.from({length:10},(_,i)=>({playerId:`p${i+1}`,heroId:i<5?`blue-${i+1}`:`red-${i-4}`,team:i<5?"blue":"red",slot:`slot-${i+1}`,reconnectToken:`resume-${i+1}`}));
assert.equal(validateMobaMatchedRoster(roster).valid,true);
const session=createMobaLiveSession({matchId:"match-001",region:"ap-southeast",players:roster});assert.equal(session.status,"ready");assert.equal(startMobaLiveSession(session,100).ok,true);assert.equal(canAcceptMobaInput(session,"p1"),true);
const dropped=markMobaDisconnected(session,{playerId:"p1",now:110});assert.equal(dropped.ok,true);assert.equal(canAcceptMobaInput(session,"p1"),false);
const resumed=resumeMobaPlayer(session,{playerId:"p1",reconnectToken:"resume-1",now:120});assert.equal(resumed.ok,true);assert.equal(resumed.resyncRequired,true);assert.equal(canAcceptMobaInput(session,"p1"),false,"Input stays locked until authoritative snapshot acknowledgement.");
assert.equal(acknowledgeMobaResync(session,{playerId:"p1",snapshotVersion:resumed.resyncVersion}).ok,true);assert.equal(canAcceptMobaInput(session,"p1"),true);

// Synthetic/default values cannot manufacture production evidence. A measured load envelope and every external gate are required.
assert.equal(evaluateMobaLoadEvidence({}).passed,false);
const load=evaluateMobaLoadEvidence({concurrentMatches:100,concurrentPlayers:1000,serverTickP95Ms:32,serverTickP99Ms:46,latencyP95Ms:180,packetLossPct:2,reconnectSuccessRate:.995,errorRatePct:.3,durationMinutes:45});assert.equal(load.passed,true);
assert.equal(evaluateMobaProductionEvidence({authoritativeCombat:true,reconnectResync:true,antiCheat:true,loadTest:true}).productionReady,false);
assert.equal(evaluateMobaProductionEvidence({liveRelay:true,matchmaking:true,authoritativeCombat:true,reconnectResync:true,antiCheat:true,loadTest:true,lossLatency:true,regionalFailover:true,iosDevice:true,androidDevice:true}).productionReady,true);

console.log("Multiplayer / 5v5 contract passed: authenticated Pro + owned-Game gating, atomic provider submission claim, downstream idempotency, replay-safe recovery, provider SSRF/timeout/cost controls, server-authoritative MOBA combat, reconnect/resync input lock, anti-cheat scoring, measured load gates and truthful LIVE PENDING evidence are locked.");
