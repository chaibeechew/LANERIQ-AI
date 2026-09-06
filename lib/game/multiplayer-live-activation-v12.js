function text(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}
const SHA = /^[a-f0-9]{7,64}$/i;

export const MOBA_LIVE_ACTIVATION_V12 = Object.freeze({
  version: "moba-live-activation-v12",
  providerNeutral: true,
  dedicatedLanerIqServerRequired: false,
  previewIsProduction: false,
  systems: Object.freeze([
    "provider-opaque-route-boundary",
    "sanitized-provider-readiness",
    "deployment-build-binding",
    "preview-activation-gate",
    "production-evidence-gate",
  ]),
  truthRule: "V12 can declare a build eligible for Live Preview only when a provider contract and exact hosted build are present. Preview READY is never Production proof; Production still requires measured evidence bound to the exact production build.",
});

export function readMobaLiveDeploymentContext(env = process.env) {
  const rawEnvironment = text(env?.VERCEL_ENV || env?.NODE_ENV || "unknown", 32).toLowerCase();
  const environment = ["production", "preview", "development"].includes(rawEnvironment) ? rawEnvironment : "unknown";
  const candidateSha = text(env?.VERCEL_GIT_COMMIT_SHA || env?.GITHUB_SHA || "", 64);
  const buildSha = SHA.test(candidateSha) ? candidateSha : null;
  return Object.freeze({
    environment,
    buildSha,
    exactBuildBound: Boolean(buildSha),
    hostedRuntime: Boolean(env?.VERCEL || env?.VERCEL_URL),
    deploymentUrlExposed: false,
  });
}

export function sanitizeMobaProviderReadiness(config = {}) {
  return Object.freeze({
    connected: config.connected === true,
    configured: config.configured === true,
    blockedByCostPolicy: config.blockedByCostPolicy === true,
    statusCheckReady: Boolean(config.statusEndpoint),
    cancellationReady: Boolean(config.cancelEndpoint),
    endpointExposed: false,
    credentialExposed: false,
    providerIdentityExposed: false,
  });
}

export function evaluateMobaLivePreviewActivation({ provider = {}, deployment = {} } = {}) {
  const checks = Object.freeze({
    providerConfigured: provider.configured === true,
    providerNotCostBlocked: provider.blockedByCostPolicy !== true,
    statusCheckReady: provider.statusCheckReady === true,
    cancellationReady: provider.cancellationReady === true,
    exactBuildBound: deployment.exactBuildBound === true,
    hostedPreviewOrProduction: ["preview", "production"].includes(deployment.environment),
  });
  const livePreviewReady = Object.values(checks).every(Boolean);
  return Object.freeze({
    version: MOBA_LIVE_ACTIVATION_V12.version,
    livePreviewReady,
    productionReady: false,
    checks,
    buildSha: deployment.buildSha || null,
    environment: deployment.environment || "unknown",
    productionEvidenceVerified: false,
    truthRule: MOBA_LIVE_ACTIVATION_V12.truthRule,
  });
}

export function evaluateMobaProductionActivation({ preview = {}, evidence = {} } = {}) {
  const evidenceBuildSha = text(evidence?.buildSha, 64);
  const checks = Object.freeze({
    livePreviewReady: preview.livePreviewReady === true,
    productionEnvironment: preview.environment === "production",
    exactBuildMatch: Boolean(preview.buildSha && evidenceBuildSha && preview.buildSha === evidenceBuildSha),
    measuredLoad: evidence.measuredLoad === true,
    soak: evidence.soak === true,
    regionalFailover: evidence.regionalFailover === true,
    edgeProtection: evidence.edgeProtection === true,
    iosDevice: evidence.iosDevice === true,
    androidDevice: evidence.androidDevice === true,
    capacityCertificate: evidence.capacityCertificate === true,
  });
  return Object.freeze({
    productionReady: Object.values(checks).every(Boolean),
    checks,
    truthRule: "Production activation requires exact-production-build measured evidence. No environment flag, preview deployment or modeled capacity can substitute for those proofs.",
  });
}
