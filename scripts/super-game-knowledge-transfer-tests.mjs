import assert from "node:assert/strict";
import fs from "node:fs";
import {FORGE_CATEGORIES,createForgeBlueprintFromPrompt,rebalanceForgeBlueprint,compileForgeBlueprintToGameBrief} from "../lib/game/game-intelligence-forge-v1.js";
import {createAiMapWorldManifest} from "../lib/game/super-game-composer-v1.js";
import {buildSuperGameFusionRequestV2} from "../lib/game/super-game-fusion-v2.js";

const required=["weapon","item","treasure","skill","magic","kungfu","ultimate","defense","healing","buff","debuff","summon","transformation","character_build","combat_balance"];
assert.deepEqual(FORGE_CATEGORIES,required);
const ultimate=createForgeBlueprintFromPrompt("设计一个原创雷属性女剑士大招，东方武侠感觉，能打5个敌人，最后一剑回血",{category:"ultimate"});
assert.equal(ultimate.levelCurve.length,10);assert.equal(ultimate.element,"lightning");assert.equal(ultimate.truth.executableCode,false);assert.equal(ultimate.truth.originalOnly,true);assert.ok(ultimate.formula.targetCap<=20);assert.ok(ultimate.effects.includes("healing_conversion"));
const pvp=rebalanceForgeBlueprint(ultimate,"PvP平衡一点");assert.ok(pvp.pvp.powerMultiplier<=.78);assert.ok(pvp.pvp.controlMultiplier<=.68);assert.match(compileForgeBlueprintToGameBrief(pvp),/bounded data/i);
const world=createAiMapWorldManifest({prompt:"Create an original fantasy adventure world",worldType:"fantasy",scale:"district"});assert.equal(world.truth.liveGeospatialData,false);assert.ok(world.zones.length>=5);assert.ok(world.routes.length>=4);
const request=buildSuperGameFusionRequestV2({requestId:"super-game:test-001",idea:"Create an original RPG",worldManifest:world,forgeBlueprints:[pvp],settings:{physicsLevel:"advanced"}});assert.equal(request.superGameFusion.version,"2.0.0");assert.equal(request.superGameFusion.forge.blueprints.length,1);assert.match(request.idea,/GAME INTELLIGENCE FORGE/);
const forgeSource=fs.readFileSync("lib/game/game-intelligence-forge-v1.js","utf8");assert.doesNotMatch(forgeSource,/\beval\s*\(/);assert.doesNotMatch(forgeSource,/new\s+Function\s*\(/);
const route=fs.readFileSync("app/api/super-game/generate/route.js","utf8");assert.match(route,/POST as generateGame/);assert.match(route,/\.eq\("user_id",user\.id\)/);assert.match(route,/asset_library/);
const worldRoute=fs.readFileSync("app/api/ai-map/worlds/route.js","utf8");assert.match(worldRoute,/liveGeospatialDataUsed:false/);assert.match(worldRoute,/\.eq\("user_id",user\.id\)/);
const migration=fs.readFileSync("supabase/migrations/20260906140500_create_game_forge_blueprints.sql","utf8");assert.match(migration,/enable row level security/i);assert.match(migration,/user_id=\(select auth\.uid\(\)\)/);
console.log("✓ LANERIQ Super Game knowledge transfer: World + Character + Combat Forge + Fusion contracts verified");
