import { createHash } from "node:crypto";

export const CONTROL_TOWER_REQUIRED_EVIDENCE = Object.freeze({
  rc: Object.freeze(["github_ci", "security", "benchmark"]),
  production: Object.freeze(["github_ci", "security", "benchmark", "vercel_deployment", "supabase_migration"]),
});

export const CONTROL_TOWER_EVIDENCE_MAX_AGE_MINUTES = Object.freeze({
  github_ci: 6 * 60,
  vercel_deployment: 6 * 60,
  security: 24 * 60,
  benchmark: 24 * 60,
  supabase_migration: 24 * 60,
  screenshot: 24 * 60,
  github_pr: 24 * 60,
  manual: 4 * 60,
});

const MAX_FUTURE_SKEW_MINUTES = 5;
const MAX_ROLLBACK_AGE_MINUTES = 30 * 24 * 60;
const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoMs(value) {
  const text = clean(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])]),
  );
}

function evidenceKind(item) {
  return clean(item?.metadata?.kind)?.toLowerCase() || null;
}

function evidenceCapturedAt(item) {
  return clean(item?.metadata?.captured_at) || clean(item?.updated_at) || clean(item?.created_at);
}

function evidenceFingerprint(item) {
  return clean(item?.metadata?.fingerprint);
}

function invalidSloResult({ availabilityTarget, windowMinutes, reason }) {
  return {
    healthy: false,
    state: "invalid",
    score: 0,
    availabilityTarget: Number.isFinite(availabilityTarget) ? availabilityTarget : null,
    windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : null,
    budgetMinutes: null,
    consumedMinutes: null,
    remainingMinutes: null,
    burnRate: null,
    errorRate: null,
    reason,
  };
}

export function evaluateControlTowerEvidenceFreshness({
  items = [],
  phase = "production",
  now = new Date().toISOString(),
  maxAgeMinutes = CONTROL_TOWER_EVIDENCE_MAX_AGE_MINUTES,
} = {}) {
  const required = CONTROL_TOWER_REQUIRED_EVIDENCE[phase] || CONTROL_TOWER_REQUIRED_EVIDENCE.production;
  const nowMs = isoMs(now) ?? Date.now();
  const evidence = items.filter((item) => String(item?.item_type || "").toLowerCase() === "evidence");
  const byKind = new Map();

  for (const item of evidence) {
    const kind = evidenceKind(item);
    if (!kind) continue;
    const capturedMs = isoMs(evidenceCapturedAt(item));
    const previous = byKind.get(kind);
    if (!previous || (capturedMs || 0) > (previous.capturedMs || 0)) {
      byKind.set(kind, { item, capturedMs });
    }
  }

  const details = required.map((kind) => {
    const entry = byKind.get(kind);
    const limit = Number(maxAgeMinutes?.[kind]) || 60;
    if (!entry) return { kind, state: "missing", ageMinutes: null, maxAgeMinutes: limit, fingerprint: null };
    const fingerprint = evidenceFingerprint(entry.item);
    if (!entry.capturedMs || !SHA256.test(fingerprint || "")) {
      return { kind, state: "invalid", ageMinutes: null, maxAgeMinutes: limit, fingerprint };
    }
    const deltaMinutes = (nowMs - entry.capturedMs) / 60000;
    if (deltaMinutes < -MAX_FUTURE_SKEW_MINUTES) {
      return { kind, state: "invalid", ageMinutes: Math.round(deltaMinutes), maxAgeMinutes: limit, fingerprint };
    }
    const ageMinutes = Math.max(0, Math.round(deltaMinutes));
    return {
      kind,
      state: ageMinutes <= limit ? "fresh" : "stale",
      ageMinutes,
      maxAgeMinutes: limit,
      fingerprint,
    };
  });

  const missing = details.filter((item) => item.state === "missing").map((item) => item.kind);
  const stale = details.filter((item) => item.state === "stale").map((item) => item.kind);
  const invalid = details.filter((item) => item.state === "invalid").map((item) => item.kind);
  const freshCount = details.filter((item) => item.state === "fresh").length;
  const score = details.length ? Math.round((freshCount / details.length) * 100) : 0;

  return {
    phase,
    required,
    score,
    healthy: missing.length === 0 && stale.length === 0 && invalid.length === 0,
    missing,
    stale,
    invalid,
    details,
  };
}

export function evaluateControlTowerSloBudget({
  availabilityTarget = 0.999,
  windowMinutes = 30 * 24 * 60,
  badMinutes = null,
  requests = null,
  errors = null,
} = {}) {
  const target = Number(availabilityTarget);
  const window = Number(windowMinutes);
  if (!Number.isFinite(target) || target < 0.9 || target > 0.99999) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "invalid_availability_target" });
  }
  if (!Number.isFinite(window) || window <= 0) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "invalid_window" });
  }

  const budgetMinutes = Math.max(0.0001, window * (1 - target));
  const hasBadMinutes = badMinutes !== null && badMinutes !== undefined && badMinutes !== "" && Number.isFinite(Number(badMinutes));
  const hasRequests = requests !== null && requests !== undefined && requests !== "" && Number.isFinite(Number(requests));
  const hasErrors = errors !== null && errors !== undefined && errors !== "" && Number.isFinite(Number(errors));
  const badMinuteCount = hasBadMinutes ? Number(badMinutes) : null;
  const requestCount = hasRequests ? Number(requests) : null;
  const errorCount = hasErrors ? Number(errors) : null;

  if (badMinuteCount !== null && badMinuteCount < 0) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "negative_bad_minutes" });
  }
  if (requestCount !== null && requestCount < 0) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "negative_requests" });
  }
  if (errorCount !== null && errorCount < 0) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "negative_errors" });
  }
  if (requestCount !== null && errorCount !== null && errorCount > requestCount) {
    return invalidSloResult({ availabilityTarget: target, windowMinutes: window, reason: "errors_exceed_requests" });
  }

  let observedBadMinutes = badMinuteCount;
  let errorRate = null;
  if (requestCount !== null && requestCount > 0 && errorCount !== null) {
    errorRate = errorCount / requestCount;
    if (observedBadMinutes === null) observedBadMinutes = window * errorRate;
  }

  if (observedBadMinutes === null) {
    return {
      healthy: false,
      state: "missing",
      score: 0,
      availabilityTarget: target,
      windowMinutes: window,
      budgetMinutes,
      consumedMinutes: null,
      remainingMinutes: null,
      burnRate: null,
      errorRate,
      reason: "missing_error_budget_telemetry",
    };
  }

  const burnRate = observedBadMinutes / budgetMinutes;
  const remainingMinutes = Math.max(0, budgetMinutes - observedBadMinutes);
  const state = burnRate >= 1 ? "exhausted" : burnRate >= 0.8 ? "critical" : burnRate >= 0.5 ? "warning" : "healthy";
  const score = Math.round(clamp((1 - burnRate) * 100, 0, 100));

  return {
    healthy: burnRate < 1,
    state,
    score,
    availabilityTarget: target,
    windowMinutes: window,
    budgetMinutes,
    consumedMinutes: observedBadMinutes,
    remainingMinutes,
    burnRate,
    errorRate,
    reason: null,
  };
}

export function selectControlTowerRollbackCandidate({
  deployments = [],
  currentSha = null,
  now = new Date().toISOString(),
  maxAgeMinutes = MAX_ROLLBACK_AGE_MINUTES,
} = {}) {
  const current = clean(currentSha)?.toLowerCase() || null;
  const nowMs = isoMs(now) ?? Date.now();
  const candidates = deployments
    .map((deployment) => {
      const capturedAt = clean(deployment?.capturedAt) || clean(deployment?.captured_at);
      const capturedMs = isoMs(capturedAt);
      const ageMinutes = capturedMs === null ? null : (nowMs - capturedMs) / 60000;
      return {
        sha: clean(deployment?.sha)?.toLowerCase() || null,
        environment: clean(deployment?.environment)?.toLowerCase() || "unknown",
        state: clean(deployment?.state)?.toLowerCase() || "unknown",
        healthy: deployment?.healthy === true,
        verified: deployment?.verified === true,
        capturedAt,
        ageMinutes,
      };
    })
    .filter((deployment) =>
      SHA40.test(deployment.sha || "") &&
      deployment.sha !== current &&
      deployment.environment === "production" &&
      deployment.state === "ready" &&
      deployment.healthy &&
      deployment.verified &&
      deployment.ageMinutes !== null &&
      deployment.ageMinutes >= -MAX_FUTURE_SKEW_MINUTES &&
      deployment.ageMinutes <= maxAgeMinutes,
    )
    .sort((a, b) => (isoMs(b.capturedAt) || 0) - (isoMs(a.capturedAt) || 0));

  const candidate = candidates[0] || null;
  return {
    ready: Boolean(candidate),
    candidate: candidate ? { ...candidate, ageMinutes: Math.max(0, Math.round(candidate.ageMinutes)) } : null,
    candidateCount: candidates.length,
    maxAgeMinutes,
  };
}

function deploymentEvidence(items = []) {
  return items
    .filter((item) => evidenceKind(item) === "vercel_deployment")
    .map((item) => {
      const snapshot = item?.metadata?.snapshot || {};
      return {
        sha: clean(snapshot.sha) || clean(snapshot.commit_sha) || clean(snapshot.commitSha),
        environment: clean(snapshot.environment) || clean(snapshot.env),
        state: clean(snapshot.state) || clean(snapshot.status),
        healthy: snapshot.healthy === true || String(snapshot.health || "").toLowerCase() === "healthy",
        verified: snapshot.verified === true || snapshot.production_verified === true,
        capturedAt: evidenceCapturedAt(item),
      };
    });
}

function latestSloSnapshot(items = []) {
  return items
    .filter((item) => evidenceKind(item) === "benchmark")
    .map((item) => ({ snapshot: item?.metadata?.snapshot || {}, capturedAt: evidenceCapturedAt(item) }))
    .sort((a, b) => (isoMs(b.capturedAt) || 0) - (isoMs(a.capturedAt) || 0))
    .find((entry) => entry.snapshot?.slo || entry.snapshot?.availabilityTarget || entry.snapshot?.availability_target)?.snapshot || null;
}

export function buildControlTowerReleaseAttestation({ release, gates = [], items = [], liveStatus = null } = {}) {
  const evidence = items
    .filter((item) => String(item?.item_type || "").toLowerCase() === "evidence")
    .map((item) => ({
      kind: evidenceKind(item),
      fingerprint: evidenceFingerprint(item),
      capturedAt: evidenceCapturedAt(item),
      trustLevel: clean(item?.metadata?.trust_level)?.toLowerCase() || null,
      sourceProvider: clean(item?.metadata?.source_provider)?.toLowerCase() || null,
      subjectSha: clean(item?.metadata?.subject_sha)?.toLowerCase() || null,
    }))
    .filter((item) => item.kind && SHA256.test(item.fingerprint || ""))
    .sort((a, b) => `${a.kind}:${a.fingerprint}`.localeCompare(`${b.kind}:${b.fingerprint}`));

  const manifest = stable({
    release: {
      id: release?.id || null,
      productVersion: release?.product_version || null,
      releaseVersion: release?.release_version || null,
      stage: release?.stage || null,
    },
    identity: {
      mainSha: liveStatus?.github?.mainSha || null,
      runtimeSha: liveStatus?.runtime?.commitSha || null,
      environment: liveStatus?.runtime?.environment || null,
      exactSha: Boolean(liveStatus?.releaseTruth?.exactSha),
      productionVerified: Boolean(liveStatus?.releaseTruth?.productionVerified),
    },
    gates: gates
      .map((gate) => ({
        key: String(gate?.gate_key || "").toLowerCase(),
        required: gate?.required !== false,
        state: String(gate?.state || "pending").toLowerCase(),
        checkedAt: gate?.checked_at || null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    evidence,
  });

  const canonical = JSON.stringify(manifest);
  return {
    algorithm: "sha256",
    digest: createHash("sha256").update(canonical).digest("hex"),
    manifest,
  };
}

export function computeControlTowerOperationalResilience({
  release,
  items = [],
  gates = [],
  liveStatus = null,
  now = new Date().toISOString(),
} = {}) {
  const phase = String(release?.stage || "").toLowerCase() === "release_candidate" ? "rc" : "production";
  const evidence = evaluateControlTowerEvidenceFreshness({ items, phase, now });
  const sloSnapshot = latestSloSnapshot(items);
  const slo = evaluateControlTowerSloBudget(sloSnapshot?.slo || sloSnapshot || {});
  const deployments = deploymentEvidence(items);
  const rollback = selectControlTowerRollbackCandidate({
    deployments,
    currentSha: liveStatus?.runtime?.commitSha,
    now,
  });
  const attestation = buildControlTowerReleaseAttestation({ release, gates, items, liveStatus });
  const productionTruth = Boolean(liveStatus?.releaseTruth?.productionVerified);

  const blockers = [];
  if (!evidence.healthy) blockers.push("Required release evidence is missing, stale, invalid, or unsealed.");
  if (!slo.healthy) blockers.push("SLO error budget is missing, invalid, or exhausted.");
  if (!rollback.ready) blockers.push("No recent verified healthy Production rollback candidate exists.");
  if (phase === "production" && !productionTruth) blockers.push("Production exact-SHA truth is not verified.");

  const truthScore = phase === "rc" ? 100 : productionTruth ? 100 : 0;
  const rollbackScore = rollback.ready ? 100 : 0;
  const overall = Math.round(evidence.score * 0.3 + slo.score * 0.3 + rollbackScore * 0.2 + truthScore * 0.2);

  return {
    phase,
    overall,
    evidence,
    slo,
    rollback,
    attestation,
    productionTruth,
    blockers,
    resilient: blockers.length === 0,
    technicalCeilingEligible: overall === 100 && blockers.length === 0,
  };
}
