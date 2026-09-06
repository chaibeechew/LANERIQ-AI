import assert from "node:assert/strict";
import {bindMobaPlayer,createMobaAuthoritativeCombat,mobaAntiCheatState} from "../lib/game/moba-authoritative-combat-v2.js";
import {buildMobaHeroSpec} from "../lib/game/moba-hero-forge-v1.js";
import {applyMobaMovementControl,clearExpiredMobaMovementControl,MOBA_MOVEMENT_CC_AUTHORITY_V1,submitMobaMovementIntentWithCc} from "../lib/game/moba-movement-cc-authority-v1.js";
import {bindMobaServerHeroKit,MOBA_HERO_ABILITY_AUTHORITY_V1,submitMobaHeroAbilityIntent} from "../lib/game/moba-hero-ability-authority-v1.js";
import {advanceMobaBattlefield,canDamageMobaStructure,createMobaBattlefieldAuthority,damageMobaStructure,defeatMobaNeutralObjective,MOBA_BATTLEFIELD_AUTHORITY_V1} from "../lib/game/moba-battlefield-authority-v1.js";
import {computeMobaTeamVision,createMobaVisionState,filterMobaSnapshotForTeam,MOBA_VISION_AUTHORITY_V1,placeMobaWard} from "../lib/game/moba-vision-authority-v1.js";
import {buildMobaRecommendedItems,MOBA_ITEM_SHOP_AUTHORITY_V1,purchaseMobaItem,sellMobaItem} from "../lib/game/moba-item-shop-authority-v1.js";
import {createMobaDraft,evaluateMobaDraft,MOBA_DRAFT_AUTHORITY_V1,submitMobaDraftAction} from "../lib/game/moba-draft-authority-v1.js";
import {appendMobaReplayEvent,buildMobaSpectatorFeed,createMobaReplayLog,MOBA_REPLAY_SPECTATOR_V1,verifyMobaReplayChain} from "../lib/game/moba-replay-spectator-v1.js";
import {buildMobaMatchAnalytics,MOBA_MATCH_ANALYTICS_V1} from "../lib/game/moba-match-analytics-v1.js";
import {chooseMobaBotAction,MOBA_BOT_STRATEGY_V2,simulateMobaBotDecisionBatch} from "../lib/game/moba-bot-strategy-v2.js";
import {MOBA_BALANCE_OPTIMIZER_V2,optimizeMobaHeroBalance} from "../lib/game/moba-balance-optimizer-v2.js";
import {advanceMobaPatchRollout,buildMobaPatchRollout,createMobaSeasonConfig,evaluateMobaPatchPromotion,MOBA_LIVEOPS_SEASON_V1} from "../lib/game/moba-liveops-season-v1.js";

assert.equal(MOBA_MOVEMENT_CC_AUTHORITY_V1.authoritative,true);
assert.equal(MOBA_HERO_ABILITY_AUTHORITY_V1.clientDamageTrusted,false);
assert.equal(MOBA_BATTLEFIELD_AUTHORITY_V1.authoritative,true);
assert.equal(MOBA_VISION_AUTHORITY_V1.clientVisibilityTrusted,false);
assert.equal(MOBA_ITEM_SHOP_AUTHORITY_V1.realMoneyStats,false);
assert.equal(MOBA_DRAFT_AUTHORITY_V1.picksPerTeam,5);
assert.equal(MOBA_REPLAY_SPECTATOR_V1.authoritativeEventsOnly,true);
assert.equal(MOBA_MATCH_ANALYTICS_V1.rawChatExcluded,true);
assert.equal(MOBA_BOT_STRATEGY_V2.deterministic,true);
assert.equal(MOBA_BALANCE_OPTIMIZER_V2.simulationOnly,true);
assert.equal(MOBA_LIVEOPS_SEASON_V1.autoProductionWithoutEvidence,false);

// Hero Forge ability semantics are server-bound; client heal/damage claims are not authoritative.
const abilityState=createMobaAuthoritativeCombat({name:"Ceiling Ability Arena",game:{enabled:true,archetype:"moba"}});
bindMobaPlayer(abilityState,{playerId:"blue-player",heroId:"blue-1"});
bindMobaPlayer(abilityState,{playerId:"red-player",heroId:"red-1"});
const blue1=abilityState.match.heroes.find(h=>h.id==="blue-1"),blue2=abilityState.match.heroes.find(h=>h.id==="blue-2"),red1=abilityState.match.heroes.find(h=>h.id==="red-1");
blue1.x=200;blue1.y=200;blue2.x=225;blue2.y=200;blue2.health=500;red1.x=320;red1.y=200;
const support=buildMobaHeroSpec({heroName:"Ceiling Support",role:"support",element:"light"});
assert.equal(bindMobaServerHeroKit(abilityState,{heroId:"blue-1",heroSpec:support}).ok,true);
const healResult=submitMobaHeroAbilityIntent(abilityState,{playerId:"blue-player",sequence:1,actionId:"support-w",slot:"W",targetId:"blue-2",heal:999999,shield:999999});
assert.equal(healResult.ok,true);assert.deepEqual(healResult.healed,["blue-2"]);assert.deepEqual(healResult.shielded,["blue-2"]);assert.ok(blue2.health>500&&blue2.health<1500);assert.ok(mobaAntiCheatState(abilityState,"blue-player").score>=4);

// Tank dash strike applies server stun; movement authority locks the stunned target and applies server slow.
const tank=buildMobaHeroSpec({heroName:"Ceiling Tank",role:"tank",element:"ice"});
assert.equal(bindMobaServerHeroKit(abilityState,{heroId:"blue-1",heroSpec:tank}).ok,true);
const tankSource=abilityState.match.heroes.find(h=>h.id==="blue-1");let controlledRed=abilityState.match.heroes.find(h=>h.id==="red-1");
tankSource.cooldowns.Q=0;tankSource.resource=400;tankSource.x=100;tankSource.y=360;controlledRed.x=225;controlledRed.y=360;
const charge=submitMobaHeroAbilityIntent(abilityState,{playerId:"blue-player",sequence:2,actionId:"tank-q",slot:"Q",aimX:1,aimY:0});
controlledRed=abilityState.match.heroes.find(h=>h.id==="red-1");assert.equal(charge.ok,true);assert.ok(charge.hits.includes("red-1"));assert.ok(controlledRed.statuses.stunUntil>abilityState.now);
const stunnedMove=submitMobaMovementIntentWithCc(abilityState,{playerId:"red-player",sequence:1,actionId:"red-stunned",x:1,y:0,now:.05});assert.equal(stunnedMove.reason,"stunned");
abilityState.now=1;applyMobaMovementControl(controlledRed,{now:1,slowPct:.5,slowSeconds:2});const beforeX=controlledRed.x;
const slowedMove=submitMobaMovementIntentWithCc(abilityState,{playerId:"red-player",sequence:2,actionId:"red-slow",x:1,y:0,now:1.05});assert.equal(slowedMove.ok,true);assert.equal(slowedMove.speedMultiplier,.5);assert.ok(controlledRed.x-beforeX<abilityState.config.hero.moveSpeed*.051);
abilityState.now=4;clearExpiredMobaMovementControl(abilityState);assert.equal(controlledRed.statuses.slowPct,0);

// Battlefield authority: waves, structure chain, neutral rewards and respawn.
const field=createMobaBattlefieldAuthority();for(let i=0;i<5;i++)advanceMobaBattlefield(field,.25);assert.equal(field.wave,1);assert.equal(field.minions.length,18);
assert.equal(canDamageMobaStructure(field,{attackingTeam:"blue",targetId:"red-mid-inner"}).reason,"previous_structure_alive");
for(let i=0;i<3;i++)damageMobaStructure(field,{attackingTeam:"blue",targetId:"red-mid-outer",serverDamage:800,actionId:`outer-${i}`});
assert.equal(canDamageMobaStructure(field,{attackingTeam:"blue",targetId:"red-mid-inner"}).allowed,true);
assert.equal(canDamageMobaStructure(field,{attackingTeam:"blue",targetId:"red-core"}).reason,"core_protected");
const objective=defeatMobaNeutralObjective(field,{objectiveId:"river-sentinel",team:"blue",actionId:"river-1"});assert.equal(objective.ok,true);assert.equal(field.teamBuffs.blue.length,1);assert.equal(defeatMobaNeutralObjective(field,{objectiveId:"river-sentinel",team:"blue",actionId:"river-1"}).replayed,true);
for(let i=0;i<361;i++)advanceMobaBattlefield(field,.25);assert.equal(field.neutrals.find(n=>n.id==="river-sentinel").alive,true);

// Server fog filters hidden enemy data and wards can reveal it.
const visionState=createMobaVisionState(),visionHeroes=[{id:"b",team:"blue",x:100,y:100,dead:false},{id:"r",team:"red",x:900,y:600,dead:false,health:900}];
let vision=computeMobaTeamVision({team:"blue",heroes:visionHeroes,visionState,now:0}),fog=filterMobaSnapshotForTeam({heroes:visionHeroes},{team:"blue",vision});assert.equal(fog.hiddenEnemyCount,1);assert.equal(fog.heroes.some(h=>h.id==="r"),false);
placeMobaWard(visionState,{team:"blue",x:900,y:600,now:0});vision=computeMobaTeamVision({team:"blue",heroes:visionHeroes,visionState,now:1});fog=filterMobaSnapshotForTeam({heroes:visionHeroes},{team:"blue",vision});assert.equal(fog.heroes.some(h=>h.id==="r"),true);

// Server item shop: gold, shop position, unique groups and reversible sell.
const itemHero={gold:5000,maxHealth:1000,maxResource:400,attackDamage:65,attackCooldown:.72,attackRange:95,armor:28,resistance:24,moveSpeed:185,inventory:[]};
assert.equal(purchaseMobaItem(itemHero,"aegis-core",{atShop:false}).reason,"shop_location_required");
const bought=purchaseMobaItem(itemHero,"aegis-core",{atShop:true});assert.equal(bought.ok,true);assert.equal(bought.hero.inventory.length,1);assert.equal(purchaseMobaItem(bought.hero,"night-reaver",{atShop:true}).reason,"unique_group_conflict");
const sold=sellMobaItem(bought.hero,"aegis-core",{atShop:true});assert.equal(sold.ok,true);assert.equal(sold.hero.inventory.length,0);assert.equal(buildMobaRecommendedItems({role:"marksman"}).length,6);

// Competitive draft is server turn-ordered with unique locks and role coverage.
const heroPool=Array.from({length:20},(_,i)=>`hero-${i+1}`),draft=createMobaDraft({heroPool}),roleCycle=["tank","fighter","assassin","mage","marksman"],pickIndex={blue:0,red:0};
for(let i=0;i<draft.order.length;i++){const [type,team]=draft.order[i],role=type==="pick"?roleCycle[pickIndex[team]++%roleCycle.length]:"";const r=submitMobaDraftAction(draft,{team,type,heroId:heroPool[i],playerId:`${team}-${i}`,role});assert.equal(r.ok,true);}
assert.equal(evaluateMobaDraft(draft).passed,true);

// Replay chain is tamper-evident; spectator feed is delayed and visibility-filtered.
const replay=createMobaReplayLog({matchId:"match-ceiling",buildSha:"a".repeat(40)});
appendMobaReplayEvent(replay,{sequence:1,tick:100,type:"kill",payload:{killerId:"b1",victimId:"r1",killerTeam:"blue"},visibility:"public",checkpoint:true});
appendMobaReplayEvent(replay,{sequence:2,tick:150,type:"private_state",payload:{secret:"hidden"},visibility:"private"});
appendMobaReplayEvent(replay,{sequence:3,tick:250,type:"vision",payload:{playerId:"b2",score:3},visibility:"team:blue"});
assert.equal(verifyMobaReplayChain(replay).valid,true);assert.equal(buildMobaSpectatorFeed(replay,{currentTick:500,delayTicks:200}).events.length,1);assert.equal(buildMobaSpectatorFeed(replay,{currentTick:500,delayTicks:200,team:"blue"}).events.length,2);
replay.events[0].payload.killerId="tampered";assert.equal(verifyMobaReplayChain(replay).valid,false);

// Analytics aggregate authoritative events only; no raw chat is emitted.
const analytics=buildMobaMatchAnalytics({winner:"blue",events:[
  {tick:100,type:"kill",payload:{killerId:"b1",victimId:"r1",killerTeam:"blue",assistIds:["b2"]}},
  {tick:180,type:"kill",payload:{killerId:"b1",victimId:"r2",killerTeam:"blue",assistIds:["b2","b3"]}},
  {tick:190,type:"damage",payload:{sourceId:"b1",amount:4200}},
  {tick:195,type:"gold",payload:{playerId:"b1",team:"blue",amount:600}},
  {tick:200,type:"objective",payload:{playerId:"b1",team:"blue"}}
]});assert.equal(analytics.mvp,"b1");assert.equal(analytics.teamfights.length,1);assert.equal(analytics.rawChatIncluded,false);

// Bot macro policy and exact 10K decision batch.
assert.equal(chooseMobaBotAction({healthPct:.12,enemiesNearby:3,alliesNearby:0}).action,"retreat");
assert.equal(chooseMobaBotAction({healthPct:.9,objectiveSeconds:5,alliesNearby:3,enemiesNearby:2}).action,"contest_objective");
assert.equal(simulateMobaBotDecisionBatch({contexts:[{healthPct:.1},{healthPct:.9,objectiveSeconds:4,alliesNearby:4,enemiesNearby:3}],decisions:10000}).decisions,10000);

// Balance optimizer stays bounded and simulation-only.
const assassin=buildMobaHeroSpec({heroName:"Ceiling Assassin",role:"assassin",element:"dark"}),optimized=optimizeMobaHeroBalance({hero:assassin,iterations:4,matchesPerIteration:600,seed:99});
assert.equal(optimized.evidenceLevel,"simulation_only");assert.equal(optimized.productionPatchApproved,false);assert.ok(optimized.iterations>=1&&optimized.iterations<=4);
for(const h of optimized.history)for(const c of h.patch.changes||[])assert.ok(Math.abs(c.pct)<=.08);

// Live Ops canary promotion requires exact-build measured healthy evidence and refuses synthetic evidence.
const current=createMobaSeasonConfig({seasonId:"S1",buildSha:"a".repeat(40),heroPool:["h1","h2"],patchLabel:"1.0"}),next=createMobaSeasonConfig({seasonId:"S1",buildSha:"b".repeat(40),heroPool:["h1","h2"],patchLabel:"1.1"});
const rollout=buildMobaPatchRollout({currentConfig:current,nextConfig:next,canaryPct:5}),good=evaluateMobaPatchPromotion({rollout,telemetry:{buildSha:"b".repeat(40),measured:true,synthetic:false,healthy:true},providerSmoke:{liveProviderVerified:true},integrityViolations:0,deviceEvidence:true});
assert.equal(good.passed,true);assert.equal(advanceMobaPatchRollout(rollout,good).trafficPct,25);
assert.equal(evaluateMobaPatchPromotion({rollout,telemetry:{buildSha:"b".repeat(40),measured:true,synthetic:true,healthy:true},providerSmoke:{liveProviderVerified:true},deviceEvidence:true}).passed,false);

console.log("✓ MOBA Technical Ceiling passed: server CC/movement, Hero Forge ability authority, battlefield/objectives, fog/vision, item shop, draft, tamper-evident replay/spectator, analytics, macro bots, balance optimizer and exact-build Live Ops are locked without global UI changes.");
