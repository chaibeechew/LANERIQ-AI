import assert from "node:assert/strict";
import fs from "node:fs";
import {AI_MAP_WORLD_TYPES,createAiMapWorldManifest} from "../lib/game/super-game-composer-v1.js";
import {buildSuperGameFusionRequestV2,SUPER_GAME_FUSION_V2_VERSION} from "../lib/game/super-game-fusion-v2.js";

for(const type of ["dungeon","simulation","mission_zone"])assert.ok(AI_MAP_WORLD_TYPES.includes(type),`${type} world knowledge missing`);
for(const [type,prompt] of [["dungeon","Create an original dungeon with puzzle rooms and boss gate"],["simulation","Create a city simulation with utilities, transit and scenario goals"],["mission_zone","Create a mission zone with intel, optional objective and extraction"]]){const world=createAiMapWorldManifest({prompt,worldType:type,scale:"district"});assert.equal(world.worldType,type);assert.ok(world.zones.length>=5);assert.ok(world.routes.length>=4);assert.equal(world.truth.liveGeospatialData,false);}
const world=createAiMapWorldManifest({prompt:"Create an original mission world",worldType:"mission_zone"});const ref="123e4567-e89b-42d3-a456-426614174001";const request=buildSuperGameFusionRequestV2({requestId:"super-game:asset-fusion",worldManifest:world,referenceAssetIds:[ref],idea:"Create an original mission RPG"});
assert.equal(SUPER_GAME_FUSION_V2_VERSION,"2.2.0");assert.deepEqual(request.superGameFusion.referenceAssetIds,[ref]);assert.ok(request.assetIds.includes(ref));assert.match(request.idea,/REUSABLE SCENE ASSETS/);assert.ok(request.superGameFusion.flow.includes("scene_assets"));
const assetRoute=fs.readFileSync("app/api/super-game/assets/route.js","utf8");assert.match(assetRoute,/sceneAssets/);assert.match(assetRoute,/\.eq\("user_id",user\.id\)/);assert.match(assetRoute,/createSignedUrl/);
const generateRoute=fs.readFileSync("app/api/super-game/generate/route.js","utf8");assert.match(generateRoute,/referenceAssetIds/);assert.match(generateRoute,/One or more selected scene assets/);assert.match(generateRoute,/\["image","video"\]/);assert.match(generateRoute,/POST as generateGame/);
const page=fs.readFileSync("app/super-game-builder/page.js","utf8");assert.match(page,/SceneAssetPicker/);assert.match(page,/referenceAssetIds/);assert.match(page,/Image\/Video/);assert.match(page,/Asset Library/);
const mapPage=fs.readFileSync("app/ai-map/page.js","utf8");for(const label of ["Dungeon","Mission Zone","Simulation"])assert.match(mapPage,new RegExp(label));
console.log("✓ Super Game scene-asset bridge + Dungeon/Simulation/Mission world knowledge verified");
