import assert from "node:assert/strict";
import fs from "node:fs";
import {FORGE_TYPES,GAME_INTELLIGENCE_FORGE_VERSION,buildGameIntelligenceForgePlan,compileForgeToGameIdea} from "../lib/ai/game-intelligence-forge.js";

const ids=FORGE_TYPES.map(item=>item.id);
for(const id of ["ultimate","physical","magic","kungfu","defense","healing","treasure","weapon","item","summon","transformation"])assert.ok(ids.includes(id),`missing forge type ${id}`);

const thunder=buildGameIntelligenceForgePlan({
  idea:"Design a lightning sword ultimate with kungfu footwork and 20% damage-to-heal conversion.",
  type:"ultimate",
  avatarAssetId:"avatar-private-123",
  avatarName:"My Hero",
  mode:"hybrid",
  powerScale:"heroic",
  targetCount:5,
});
assert.equal(thunder.version,GAME_INTELLIGENCE_FORGE_VERSION);
assert.equal(thunder.avatarBinding.privateCustomerAsset,true);
assert.equal(thunder.avatarBinding.assetId,"avatar-private-123");
assert.ok(thunder.types.includes("ultimate"));
assert.ok(thunder.types.includes("kungfu"));
assert.equal(thunder.element,"lightning");
assert.equal(thunder.combat.targetCount,5);
assert.ok(thunder.phases.length>=4);
assert.ok(thunder.balanceRules.some(item=>/PvE and PvP/i.test(item)));
assert.match(thunder.avatarBinding.identityRule,/private customer avatar/i);

const phoenix=buildGameIntelligenceForgePlan({idea:"Phoenix rebirth healing ultimate with low HP recovery, cleanse and fire buff.",type:"healing",powerScale:"mythic"});
assert.equal(phoenix.name,"Phoenix Rebirth / 凤凰涅槃");
assert.equal(phoenix.combat.healingEnabled,true);
assert.equal(phoenix.element,"fire");

const prompt=compileForgeToGameIdea(thunder);
assert.match(prompt,/original mobile action\/RPG game/i);
assert.match(prompt,/avatar-private-123/);
assert.match(prompt,/owner-scoped project input/i);
assert.match(prompt,/editable game data/i);
assert.match(prompt,/original content/i);
assert.doesNotMatch(prompt,/production performance is verified/i);

const page=fs.readFileSync("app/game-forge/page.js","utf8");
assert.match(page,/GAME INTELLIGENCE FORGE/);
assert.match(page,/\.from\("asset_library"\)/);
assert.match(page,/\.eq\("user_id",user\.id\)/);
assert.match(page,/createSignedUrl\(item\.storage_path,600\)/);
assert.match(page,/fetch\("\/api\/game\/generate"/);
assert.match(page,/assetIds:selectedAvatar\?\.id\?\[selectedAvatar\.id\]:\[\]/);
assert.match(page,/href="\/avatar-studio"/);
assert.match(page,/href="\/video-studio"/);
assert.match(page,/href="\/image-studio\?mode=create"/);
assert.match(page,/private customer reference/i);

const pro=fs.readFileSync("lib/pro-mode.js","utf8");
assert.match(pro,/Game Intelligence Forge/);
assert.match(pro,/href: "\/game-forge"/);

console.log("Game Intelligence Forge contract tests passed.");
