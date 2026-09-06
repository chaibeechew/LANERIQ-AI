import { generateWithFallback, getProviderRuntimeHealth } from "../../engine/ai-provider.js";
import { freeTierHardStopProviders, getSoolenCostMode } from "../soolen/cost-policy.js";
import { assertAdmissionSafe, decideZeroCostAdmission } from "./zero-cost-admission-controller.js";
import { getSemanticReuseTruth, lookupSemanticReuse, storeSemanticReuse } from "./semantic-reuse-network.js";
import {
  getSemanticReusePersistenceTruth,
  lookupPersistentSemanticReuse,
  storePersistentSemanticReuse,
} from "./semantic-reuse-persistence.js";

const LOCAL_PROVIDERS = new Set(["ollama", "soolen-local"]);

const runtime = globalThis.__LANERIQ_ZERO_COST_ADMISSION_RUNTIME || {
  requests: 0,
  reuseHits: 0,
  persistentReuseHits: 0,
  localResolutions: 0,
  verifiedFreeResolutions: 0,
  paidResolutions: 0,
  queued: 0,
  blocked: 0,
  localFailuresBeforeFallback: 0,
};
runtime.persistentReuseHits ||= 0;
globalThis.__LANERIQ_ZERO_COST_ADMISSION_RUNTIME = runtime;

function configuredProviderSets(env = process.env) {
  const health = getProviderRuntimeHealth();
  const configured = health.filter((item) => item.configured).map((item) => item.provider);
  const local = configured.filter((provider) => LOCAL_PROVIDERS.has(provider));
  const hardStops = new Set(freeTierHardStopProviders(env));
  const verifiedFree = configured.filter((provider) => !LOCAL_PROVIDERS.has(provider) && hardStops.has(provider));
  const remote = configured.filter((provider) => !LOCAL_PROVIDERS.has(provider));
  return Object.freeze({ configured, local, verifiedFree, remote });
}

function providerResult(result, admission, source, reuse = null) {
  return Object.freeze({
    ...result,
    admission,
    admissionSource: source,
    semanticReuse: reuse,
  });
}

function errorWithCode(code, message, status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function executeProviders(prompt, providers) {
  if (!Array.isArray(providers) || !providers.length) throw errorWithCode("LANERIQ_NO_ADMITTED_PROVIDER", "No admitted AI provider is available.");
  return generateWithFallback(prompt, { providers });
}

async function resolveSemanticReuse({
  reuseAllowed,
  scope,
  purpose,
  keyMaterial,
  reuseVariant,
  reuseClass,
  allowApproximateReuse,
  env,
}) {
  if (!reuseAllowed) return Object.freeze({ hit: false, exact: false, approximate: false, reason: "reuse_disabled" });

  const hot = lookupSemanticReuse({
    scope,
    purpose,
    keyMaterial,
    variant: reuseVariant,
    reuseClass,
    allowApproximate: allowApproximateReuse,
  });
  if (hot.hit) return Object.freeze({ ...hot, source: "runtime" });

  const persistent = await lookupPersistentSemanticReuse({
    scope,
    purpose,
    keyMaterial,
    variant: reuseVariant,
    env,
  });
  if (!persistent.hit) return hot;

  const remainingTtl = Number.isFinite(persistent.expiresAtMs)
    ? Math.max(30_000, persistent.expiresAtMs - Date.now())
    : undefined;
  storeSemanticReuse({
    scope,
    purpose,
    keyMaterial,
    variant: reuseVariant,
    reuseClass: persistent.reuseClass || reuseClass,
    result: persistent.result,
    ttlMs: remainingTtl,
  });
  return persistent;
}

export async function generateWithZeroCostAdmission(prompt, {
  scope,
  purpose = "general",
  reuseKeyMaterial,
  reuseVariant = "",
  reuseClass = "private_result",
  reuseAllowed = true,
  reuseTtlMs,
  allowApproximateReuse = false,
  deterministicResult = null,
  interactive = true,
  queueAllowed = false,
  attachmentCount = 0,
  requestedAgents = 1,
  paidFallbackAllowed = false,
  env = process.env,
} = {}) {
  const raw = String(prompt || "").trim();
  if (!raw) throw errorWithCode("LANERIQ_ADMISSION_PROMPT_REQUIRED", "AI prompt is empty.", 400);
  runtime.requests += 1;

  const costMode = getSoolenCostMode(env);
  const keyMaterial = String(reuseKeyMaterial || raw);
  const reuse = await resolveSemanticReuse({
    reuseAllowed,
    scope,
    purpose,
    keyMaterial,
    reuseVariant,
    reuseClass,
    allowApproximateReuse,
    env,
  });
  const providers = configuredProviderSets(env);
  const deterministicHit = typeof deterministicResult === "string" && deterministicResult.trim().length > 0;

  const admission = decideZeroCostAdmission({
    costMode,
    reuseHit: reuse.hit,
    deterministicHit,
    localEngineAvailable: providers.local.length > 0,
    freeProviderAvailable: providers.verifiedFree.length > 0,
    freeProviderHardStopVerified: providers.verifiedFree.length > 0,
    paidProviderAvailable: providers.remote.length > 0,
    paidFallbackAllowed,
    interactive,
    queueAllowed,
    promptChars: raw.length,
    attachmentCount,
    requestedAgents,
  });
  assertAdmissionSafe(admission, { costMode });

  if (admission.route === "DETERMINISTIC") {
    runtime.localResolutions += 1;
    return providerResult({ provider: "laneriq-deterministic", result: deterministicResult, attempts: 0, errors: [] }, admission, "deterministic");
  }
  if (admission.route === "REUSE") {
    runtime.reuseHits += 1;
    if (reuse.source === "persistent") runtime.persistentReuseHits += 1;
    return providerResult({
      provider: reuse.source === "persistent" ? "laneriq-semantic-reuse-persistent" : "laneriq-semantic-reuse",
      result: reuse.result,
      attempts: 0,
      errors: [],
    }, admission, "reuse", reuse);
  }
  if (admission.route === "QUEUE") {
    runtime.queued += 1;
    throw errorWithCode("LANERIQ_ZERO_COST_CAPACITY_QUEUED", "Zero-cost capacity is deferred for this non-interactive task.", 503);
  }
  if (admission.route === "BLOCK" || !admission.admitted) {
    runtime.blocked += 1;
    throw errorWithCode("LANERIQ_ZERO_COST_ADMISSION_BLOCKED", `AI execution blocked by zero-cost admission policy: ${admission.reason}`, 503);
  }

  let executed;
  let source = "local";
  try {
    // Cost-free local execution is always attempted before consuming a verified free-tier quota.
    if (providers.local.length) executed = await executeProviders(raw, providers.local);
  } catch (localError) {
    runtime.localFailuresBeforeFallback += 1;
    if (costMode === "zero") throw localError;
  }

  if (!executed && costMode === "free" && providers.verifiedFree.length) {
    executed = await executeProviders(raw, providers.verifiedFree);
    source = "verified_free";
  }

  if (!executed && (costMode === "balanced" || costMode === "paid") && paidFallbackAllowed && providers.remote.length) {
    executed = await executeProviders(raw, providers.remote);
    source = "paid_policy";
  }

  if (!executed) {
    runtime.blocked += 1;
    throw errorWithCode("LANERIQ_NO_ADMITTED_CAPACITY", "No admitted zero-cost AI capacity completed the request.", 503);
  }

  if (source === "local") runtime.localResolutions += 1;
  else if (source === "verified_free") runtime.verifiedFreeResolutions += 1;
  else runtime.paidResolutions += 1;

  const stored = reuseAllowed
    ? storeSemanticReuse({ scope, purpose, keyMaterial, variant: reuseVariant, reuseClass, result: executed.result, ttlMs: reuseTtlMs })
    : Object.freeze({ stored: false, reason: "reuse_disabled" });
  const persistentStored = stored.stored === true
    ? await storePersistentSemanticReuse({
      scope,
      purpose,
      keyMaterial,
      variant: reuseVariant,
      reuseClass,
      result: executed.result,
      ttlMs: reuseTtlMs,
      env,
    })
    : Object.freeze({ stored: false, persistence: true, reason: stored.reason || "runtime_store_not_admitted" });

  return providerResult(executed, admission, source, {
    hit: false,
    stored: stored.stored === true,
    persistentStored: persistentStored.stored === true,
    exact: false,
    approximate: false,
  });
}

export function getZeroCostAdmissionRuntimeTruth(env = process.env) {
  const requests = Number(runtime.requests || 0);
  const zeroCostResolved = Number(runtime.reuseHits || 0) + Number(runtime.localResolutions || 0) + Number(runtime.verifiedFreeResolutions || 0);
  return Object.freeze({
    version: "2026-09-05.2",
    requests,
    zeroCostResolved,
    confirmedZeroCostResolutionRate: requests > 0 ? Number((zeroCostResolved / requests).toFixed(4)) : 0,
    reuseHits: Number(runtime.reuseHits || 0),
    persistentReuseHits: Number(runtime.persistentReuseHits || 0),
    localResolutions: Number(runtime.localResolutions || 0),
    verifiedFreeResolutions: Number(runtime.verifiedFreeResolutions || 0),
    paidResolutions: Number(runtime.paidResolutions || 0),
    queued: Number(runtime.queued || 0),
    blocked: Number(runtime.blocked || 0),
    localFailuresBeforeFallback: Number(runtime.localFailuresBeforeFallback || 0),
    localBeforeRemote: true,
    persistentReuseBeforeInference: true,
    zeroModePaidFallbackAllowed: false,
    freeModePaidFallbackAllowed: false,
    semanticReuse: getSemanticReuseTruth(),
    semanticReusePersistence: getSemanticReusePersistenceTruth(env),
    evidenceBoundary: "Admission telemetry is per-runtime routing evidence. Persistent cache hits are exact scope-isolated reuse. This does not prove provider billing statements, permanent free quota, native-device inference, or unlimited compute.",
  });
}
