import assert from "node:assert/strict";
import fs from "node:fs";
import "./moba-production-qualification-v13-tests.mjs";
import {
  MOBA_LIVE_ACTIVATION_V12,
  evaluateMobaLivePreviewActivation,
  evaluateMobaProductionActivation,
  readMobaLiveDeploymentContext,
  sanitizeMobaProviderReadiness,
} from "../lib/game/multiplayer-live-activation-v12.js";

assert.equal(MOBA_LIVE_ACTIVATION_V12.providerNeutral, true);
assert.equal(MOBA_LIVE_ACTIVATION_V12.dedicatedLanerIqServerRequired, false);
assert.equal(MOBA_LIVE_ACTIVATION_V12.previewIsProduction, false);

const provider = sanitizeMobaProviderReadiness({
  connected: true,
  configured: true,
  blockedByCostPolicy: false,
  statusEndpoint: "https://provider.example/status",
  cancelEndpoint: "https://provider.example/cancel",
  matchmakingEndpoint: "https://provider.example/match",
});
assert.equal(provider.configured, true);
assert.equal(provider.statusCheckReady, true);
assert.equal(provider.cancellationReady, true);
assert.equal(provider.endpointExposed, false);
assert.equal(provider.credentialExposed, false);
assert.doesNotMatch(JSON.stringify(provider), /provider\.example|MULTIPLAYER_PROVIDER_TOKEN/);

const buildSha = "a".repeat(40);
const previewDeployment = readMobaLiveDeploymentContext({
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_SHA: buildSha,
  VERCEL_URL: "private-preview.vercel.app",
});
assert.equal(previewDeployment.exactBuildBound, true);
assert.equal(previewDeployment.environment, "preview");
assert.equal(previewDeployment.deploymentUrlExposed, false);

const preview = evaluateMobaLivePreviewActivation({ provider, deployment: previewDeployment });
assert.equal(preview.livePreviewReady, true);
assert.equal(preview.productionReady, false);
assert.equal(preview.productionEvidenceVerified, false);

const local = evaluateMobaLivePreviewActivation({
  provider,
  deployment: readMobaLiveDeploymentContext({ NODE_ENV: "development" }),
});
assert.equal(local.livePreviewReady, false);

const productionPreview = evaluateMobaLivePreviewActivation({
  provider,
  deployment: readMobaLiveDeploymentContext({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: buildSha }),
});
assert.equal(evaluateMobaProductionActivation({ preview: productionPreview, evidence: {} }).productionReady, false);
const production = evaluateMobaProductionActivation({
  preview: productionPreview,
  evidence: {
    buildSha,
    measuredLoad: true,
    soak: true,
    regionalFailover: true,
    edgeProtection: true,
    iosDevice: true,
    androidDevice: true,
    capacityCertificate: true,
  },
});
assert.equal(production.productionReady, true);
assert.equal(evaluateMobaProductionActivation({
  preview: productionPreview,
  evidence: { ...Object.fromEntries(Object.keys(production.checks).map((key) => [key, true])), buildSha: "b".repeat(40) },
}).productionReady, false, "Production evidence must bind the exact hosted build SHA.");

const route = fs.readFileSync("app/api/game/multiplayer/matchmaking/route.js", "utf8");
const cloud = fs.readFileSync("lib/cloud/game-multiplayer.js", "utf8");
const dataAdapter = fs.readFileSync("lib/cloud-adapters/game-multiplayer-data.js", "utf8");

assert.match(route, /lib\/cloud\/game-multiplayer\.js/);
assert.match(route, /getBuilderGameMultiplayerReadiness/);
assert.match(route, /startBuilderGameMultiplayer/);
assert.match(route, /checkBuilderGameMultiplayer/);
assert.match(route, /cancelBuilderGameMultiplayer/);
assert.match(route, /MAX_REQUEST_BYTES/);
assert.match(route, /Cache-Control/);
assert.doesNotMatch(route, /lib\/supabase\//);
assert.doesNotMatch(route, /createClient|createAdminClient|getAppBuilderAccess|MULTIPLAYER_PROVIDER_TOKEN|MULTIPLAYER_MATCHMAKING_ENDPOINT/);

assert.match(cloud, /createGameMultiplayerDataAdapter/);
assert.match(cloud, /getMultiplayerProviderConfig/);
assert.match(cloud, /sanitizeMobaProviderReadiness/);
assert.match(cloud, /evaluateMobaLivePreviewActivation/);
assert.match(cloud, /provider submission/i);
assert.match(cloud, /productionEvidenceVerified:\s*false/);
assert.match(cloud, /same idempotency key after an uncertain acknowledgement/i);
assert.match(cloud, /will not start a duplicate ticket/i);

assert.match(dataAdapter, /auth\.getUser\(\)/);
assert.match(dataAdapter, /professional\?\.active/);
assert.match(dataAdapter, /\.eq\("owner_id", user\.id\)/);
assert.match(dataAdapter, /productType !== "mobile_game"/);
assert.match(dataAdapter, /game\?\.enabled !== true/);
assert.match(dataAdapter, /server_reserve_multiplayer_session/);
assert.match(dataAdapter, /server_claim_multiplayer_provider_v2/);
assert.match(dataAdapter, /server_finalize_multiplayer_provider_v2/);
assert.match(dataAdapter, /server_update_multiplayer_session/);

console.log("✓ MOBA Live Activation V12: matchmaking route is provider-opaque, Live Preview is exact-build/provider gated, and Production remains measured-evidence fail-closed.");
