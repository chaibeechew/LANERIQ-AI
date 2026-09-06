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
    if (!entry.capturedMs) return { kind, state: "invalid", ageMinutes: null, maxAgeMinutes: limit, fingerprint: evidenceFingerprint(entry.item) };
    const ageMinutes = Math.max(0, Math.round((nowMs - entry.capturedMs) / 60000));
    return {
      kind,
      state: ageMinutes <= limit ? "fresh" : "stale",
      ageMinutes,
      maxAgeMinutes: limit,
      fingerprint: evidenceFingerprint(entry.item),
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
  const target = clamp(Number(availabilityTarget) || 0.999, 0.9, 0.99999);
  const window = Math.max(1, Number(windowMinutes) || 1);
  const budgetMinutes = Math.max(0.0001, window * (1 - target));

  const hasBadMinutes = badMinutes !== null && badMinutes !== undefined && badMinutes !== "" && Number.isFinite(Number(badMinutes));
  let observedBadMinutes = hasBadMinutes ? Math.max(0, Number(badMinutes)) : null;
  const requestCount = Number(requests);
  const errorCount = Number(errors);
  let errorRate = null;

  if (Number.isFinite(requestCount) && requestCount > 0 && Number.isFinite(errorCount) && errorCount >= 0) {
    errorRate = clamp(errorCount / requestCount, 0, 1);
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
  };
}

export function selectControlTowerRollbackCandidate({ deployments = [], currentSha = null } = {}) {
  const current = clean(currentSha);
  const candidates = deployments
    .map((deployment) => ({
      sha: clean(deployment?.sha),
      environment: clean(deployment?.environment)?.toLowerCase() || "unknown",
      state: clean(deployment?.state)?.toLowerCase() || "unknown",
      healthy: deployment?.healthy === true,
      verified: deployment?.verified === true,
      capturedAt: clean(deployment?.capturedAt) || clean(deployment?.captured_at),
    }))
    .filter((deployment) =>
      deployment.sha &&
      deployment.sha !== current &&
      deployment.environment === "production" &&
      deployment.state === "ready" &&
      deployment.healthy &&
      deployment.verified,
    )
    .sort((a, b) => (isoMs(b.capturedAt) || 0) - (isoMs(a.capturedAt) || 0));

  return {
    ready: candidates.length > 0,
    candidate: candidates[0] || null,
    candidateCount: candidates.length,
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
    }))
    .filter((item) => item.kind && item.fingerprint)
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
  });
  const attestation = buildControlTowerReleaseAttestation({ release, gates, items, liveStatus });
  const productionTruth = Boolean(liveStatus?.releaseTruth?.productionVerified);

  const blockers = [];
  if (!evidence.healthy) blockers.push("Required release evidence is missing, stale, or invalid.");
  if (!slo.healthy) blockers.push("SLO error budget is missing or exhausted.");
  if (!rollback.ready) blockers.push("No verified healthy Production rollback candidate exists.");
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
