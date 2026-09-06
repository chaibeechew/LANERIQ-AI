import assert from "node:assert/strict";
import {bindMobaPlayer,createMobaAuthoritativeCombat,mobaAntiCheatState} from "../lib/game/moba-authoritative-combat-v2.js";
import {MOBA_COMBAT_INTEGRITY_V3,evaluateMobaCombatIntegrityV3,submitMobaAbilityIntentV3,submitMobaStructureAttackV3} from "../lib/game/moba-combat-integrity-v3.js";

assert.equal(MOBA_COMBAT_INTEGRITY_V3.authoritative,true);
assert.equal(MOBA_COMBAT_INTEGRITY_V3.clientTargetTrusted,false);
assert.equal(MOBA_COMBAT_INTEGRITY_V3.clientHitTrusted,false);
assert.equal(MOBA_COMBAT_INTEGRITY_V3.clientDamageTrusted,false);
assert.equal(MOBA_COMBAT_INTEGRITY_V3.clientStructureDamageTrusted,false);

const combat=createMobaAuthoritativeCombat({name:"Integrity Arena",game:{enabled:true,archetype:"moba",moba:{maxLevel:15}}});
assert.equal(bindMobaPlayer(combat,{playerId:"p-blue",heroId:"blue-1"}).ok,true);
const current=id=>combat.match.heroes.find(h=>h.id===id);

// Self-cast mobility/defense must work without inventing an enemy target.
current("blue-1").x=400;current("blue-1").y=360;
const shieldBefore=current("blue-1").shield;
const w=submitMobaAbilityIntentV3(combat,{playerId:"p-blue",sequence:1,actionId:"w-self",slot:"W",aimX:1,aimY:0,serverTick:combat.tick});
assert.equal(w.ok,true);assert.equal(w.kind,"dash_shield");assert.ok(w.source.shield>shieldBefore);assert.ok(w.source.x>400);assert.equal(w.hits.length,0);

// Server resolves first skillshot hit from authoritative positions; forged hit/damage claims cannot choose the victim or amount.
current("blue-1").x=400;current("blue-1").y=360;current("red-1").x=500;current("red-1").y=360;current("red-2").x=545;current("red-2").y=360;
const red1Before=current("red-1").health,red2Before=current("red-2").health;
const q=submitMobaAbilityIntentV3(combat,{playerId:"p-blue",sequence:2,actionId:"q-line",slot:"Q",aimX:1,aimY:0,serverTick:combat.tick,hitIds:["red-2"],damage:999999});
assert.equal(q.ok,true);assert.deepEqual(q.hits,["red-1"]);assert.ok(current("red-1").health<red1Before);assert.equal(current("red-2").health,red2Before);assert.ok(q.totalDamage>0&&q.totalDamage<999999);
assert.ok(mobaAntiCheatState(combat,"p-blue").score>=5,"Forged hit + damage claims must raise anti-cheat score.");

// AOE target set and slow duration are server owned.
current("red-1").x=505;current("red-1").y=360;current("red-2").x=535;current("red-2").y=380;
const e=submitMobaAbilityIntentV3(combat,{playerId:"p-blue",sequence:3,actionId:"e-aoe",slot:"E",targetX:520,targetY:365,serverTick:combat.tick,hitIds:[]});
assert.equal(e.ok,true);assert.ok(e.hits.includes("red-1"));assert.ok(e.hits.includes("red-2"));assert.ok(current("red-1").statuses.slowUntil>combat.now);assert.ok(current("red-2").statuses.slowUntil>combat.now);

// Impossible future client ticks are rejected and do not advance the authoritative action sequence.
const future=submitMobaAbilityIntentV3(combat,{playerId:"p-blue",sequence:4,actionId:"future-cast",slot:"R",targetX:520,targetY:360,serverTick:combat.tick+100});
assert.equal(future.ok,false);assert.equal(future.reason,"future_tick");assert.equal(combat.lastSequence.get("p-blue"),3);

// Structures accept only server-calculated damage, and the core remains protected while defending towers are alive.
current("blue-1").x=900;current("blue-1").y=360;current("blue-1").lastAttackAt=-Infinity;
const tower=combat.match.structures.towers.find(t=>t.id==="red-t1"),towerBefore=tower.health;
const towerHit=submitMobaStructureAttackV3(combat,{playerId:"p-blue",sequence:4,actionId:"tower-hit",structureId:"red-t1",damage:999999,serverTick:combat.tick});
assert.equal(towerHit.ok,true);assert.ok(towerHit.damage>0&&towerHit.damage<999999);assert.equal(tower.health,towerBefore-towerHit.damage);
const coreTry=submitMobaStructureAttackV3(combat,{playerId:"p-blue",sequence:5,actionId:"core-too-early",structureId:"red-core",serverTick:combat.tick});
assert.equal(coreTry.ok,false);assert.equal(coreTry.reason,"core_protected");

const readiness=evaluateMobaCombatIntegrityV3({skillshotServerHit:true,aoeServerTargets:true,selfCastDashShield:true,ccServerDuration:true,structureServerDamage:true,coreProtection:true,tickWindow:true,forgedClaimsRejected:true});
assert.equal(readiness.passed,true);assert.equal(readiness.score,100);assert.equal(readiness.productionReady,false);
assert.equal(evaluateMobaCombatIntegrityV3({skillshotServerHit:true}).productionReady,false);

console.log("✓ MOBA Combat Integrity V3: self-cast dash/shield, server skillshot first-hit, authoritative AOE/CC, tick-window validation, server structure damage and core protection passed.");
