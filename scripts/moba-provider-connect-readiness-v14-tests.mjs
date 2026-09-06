import assert from "node:assert/strict";
import fs from "node:fs";
import "./moba-live-completion-v15-v18-tests.mjs";
import {buildMobaCreatorProviderConnectStatus,evaluateMobaProviderConnectReadiness,MOBA_PROVIDER_CONNECT_READINESS_V14,readMobaProviderConnectionChecklist} from "../lib/game/moba-provider-connect-readiness-v14.js";

assert.equal(MOBA_PROVIDER_CONNECT_READINESS_V14.providerNeutral,true);
assert.equal(MOBA_PROVIDER_CONNECT_READINESS_V14.creatorServerConfigurationRequired,false);
assert.equal(MOBA_PROVIDER_CONNECT_READINESS_V14.secretsExposed,false);

const empty=readMobaProviderConnectionChecklist({});
assert.equal(empty.requiredSettingsComplete,false);
assert.equal(empty.missingRequiredSettings.length,4);
assert.equal(empty.secretValuesExposed,false);

const secretEnv={
  MULTIPLAYER_PROVIDER:"secret-provider-name",
  MULTIPLAYER_MATCHMAKING_ENDPOINT:"https://private-provider.example/match",
  MULTIPLAYER_STATUS_ENDPOINT:"https://private-provider.example/status",
  MULTIPLAYER_CANCEL_ENDPOINT:"https://private-provider.example/cancel",
  MULTIPLAYER_PROVIDER_TOKEN:"super-secret-token",
  VERCEL:"1",
  VERCEL_ENV:"preview",
  VERCEL_GIT_COMMIT_SHA:"a".repeat(40),
  VERCEL_URL:"private-preview.vercel.app",
};
const configured=evaluateMobaProviderConnectReadiness({
  env:secretEnv,
  providerConfig:{configured:true,blockedByCostPolicy:false},
});
assert.equal(configured.configurationReady,true);
assert.equal(configured.previewSmokeTestEligible,true);
assert.equal(configured.productionReady,false);
assert.equal(configured.nextAction,"run_real_ten_player_preview");
assert.equal(configured.optionalAuthTokenConfigured,true);
const publicJson=JSON.stringify(configured);
assert.doesNotMatch(publicJson,/private-provider\.example|super-secret-token|secret-provider-name|private-preview\.vercel\.app/);

const creator=buildMobaCreatorProviderConnectStatus({env:secretEnv,providerConfig:{configured:true,blockedByCostPolicy:false}});
assert.equal(creator.previewSmokeTestEligible,true);
assert.equal(creator.secretValuesExposed,false);
assert.equal(creator.liveProviderVerified,false);

const blocked=evaluateMobaProviderConnectReadiness({env:secretEnv,providerConfig:{configured:false,blockedByCostPolicy:true}});
assert.equal(blocked.previewSmokeTestEligible,false);
assert.equal(blocked.nextAction,"resolve_multiplayer_cost_policy");

const route=fs.readFileSync("app/api/game/multiplayer/capacity/route.js","utf8");
const readiness=fs.readFileSync("lib/game/game-creator-readiness-v2.js","utf8");
assert.match(route,/moba-provider-connect-readiness-v14\.js/);
assert.match(route,/buildMobaCreatorProviderConnectStatus/);
assert.match(route,/moba-production-certification-v18\.js/);
assert.match(route,/buildMobaV15V18CreatorStatus/);
assert.match(route,/completion/);
assert.match(route,/connection/);
assert.doesNotMatch(route,/MULTIPLAYER_PROVIDER_TOKEN/);
assert.match(readiness,/mobaProviderConnectReadinessV14/);
assert.match(readiness,/mobaRealProviderSmokeV15/);
assert.match(readiness,/mobaLiveSelfHealingV16/);
assert.match(readiness,/mobaDeviceNetworkLabV17/);
assert.match(readiness,/mobaProductionCertificationV18/);

console.log("✓ MOBA Provider Connect Readiness V14 passed: creator-safe connection guidance plus V15–V18 completion status expose no provider secret values and remain Production fail-closed.");
