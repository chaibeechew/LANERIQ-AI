import assert from "node:assert/strict";
import fs from "node:fs";
import {createAiMapWorldManifest,normalizeAvatarSelections,buildSuperGameFusionRequest,SUPER_GAME_FUSION_VERSION} from "../lib/game/super-game-composer-v1.js";

const read=path=>fs.readFileSync(path,"utf8");
const world=createAiMapWorldManifest({prompt:"Create an original futuristic island adventure world with a harbor, jungle, ruins and final mountain objective",worldType:"island",style:"futuristic",scale:"open_world"});
assert.equal(world.version,SUPER_GAME_FUSION_VERSION);
assert.equal(world.worldType,"island");
assert.equal(world.zones.length,9);
assert.ok(world.routes.length>=9);
assert.ok(world.spawnPoints.some(item=>item.role==="player"));
assert.equal(world.truth.liveGeospatialData,false);

const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const selections=normalizeAvatarSelections([{assetId:a,role:"player"},{assetId:b,role:"npc"},{assetId:a,role:"enemy"}]);
assert.deepEqual(selections,[{assetId:a,role:"player"},{assetId:b,role:"npc"}]);
const request=buildSuperGameFusionRequest({requestId:"super-game:test-1",idea:"Build a touch-first adventure with quests and boss progression",worldManifest:world,avatarSelections:selections,genre:"adventure",playMode:"open_world"});
assert.equal(request.productType,"mobile_game");
assert.deepEqual(request.assetIds,[a,b]);
assert.equal(request.superGameFusion.semanticWorldRequired,true);
assert.match(request.idea,/WORLD FUSION CONTRACT/);
assert.match(request.idea,/ORIGINALITY CONTRACT/);
assert.match(request.idea,/not live geospatial truth/i);

const migration=read("supabase/migrations/20260906213200_ai_map_super_game_world_fusion.sql");
assert.match(migration,/create table if not exists public\.game_worlds/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/user_id = \(select auth\.uid\(\)\)/i);
assert.match(migration,/unique \(user_id, request_id\)/i);

const worldRoute=read("app/api/ai-map/worlds/route.js");
assert.match(worldRoute,/auth\.getUser\(\)/);
assert.match(worldRoute,/\.eq\("user_id",user\.id\)/);
assert.match(worldRoute,/liveGeospatialDataUsed:false/);
const assetsRoute=read("app/api/super-game/assets/route.js");
assert.match(assetsRoute,/createSignedUrl/);
assert.match(assetsRoute,/\.eq\("user_id",user\.id\)/);
const fusionRoute=read("app/api/super-game/generate/route.js");
assert.match(fusionRoute,/buildSuperGameFusionRequest/);
assert.match(fusionRoute,/\.eq\("user_id",user\.id\)/);
assert.match(fusionRoute,/generateGame\(forwarded\)/);

console.log("✓ AI Map builds structured semantic worlds instead of decorative-only map images");
console.log("✓ Saved worlds are owner-scoped with RLS and replay-safe request IDs");
console.log("✓ Avatar references are owner-validated before Map + Avatar -> Game fusion");
console.log("✓ Super Game fusion reuses the existing gated Game Creator runtime");
