import { createHash } from "node:crypto";
import { sanitizeControlTowerEvidenceSnapshot } from "./control-tower-evidence.js";

function stableValue(value, depth = 0) {
  if (depth > 8) return "[max-depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => stableValue(item, depth + 1));
  if (typeof value !== "object") return String(value);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key], depth + 1)]),
  );
}

export function canonicalizeControlTowerSnapshot(value) {
  return JSON.stringify(stableValue(value));
}

export function hashControlTowerSnapshot(value) {
  return createHash("sha256").update(canonicalizeControlTowerSnapshot(value)).digest("hex");
}

function sortBy(items, selector) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => String(selector(a) || "").localeCompare(String(selector(b) || "")));
}

function releaseProjection(release) {
  if (!release) return null;
  return {
    id: release.id || null,
    product_version: release.product_version || null,
    release_version: release.release_version || null,
    capability_layer: release.capability_layer || null,
    release_status: release.release_status || null,
    stage: release.stage || null,
    target_platforms: Array.isArray(release.target_platforms) ? release.target_platforms : [],
    target_date: release.target_date || null,
    production_verified_at: release.production_verified_at || null,
    updated_at: release.updated_at || null,
  };
}

function workstreamProjection(workstream) {
  return {
    id: workstream.id || null,
    workstream_key: workstream.workstream_key || null,
    name: workstream.name || null,
    stage: workstream.stage || null,
    dependencies: Array.isArray(workstream.dependencies) ? [...workstream.dependencies].sort() : [],
    updated_at: workstream.updated_at || null,
  };
}

function itemProjection(item) {
  return {
    id: item.id || null,
    workstream_id: item.workstream_id || null,
    item_type: item.item_type || null,
    title: item.title || null,
    stage: item.stage || null,
    priority: item.priority || null,
    external_ref: item.external_ref || null,
    metadata: sanitizeControlTowerEvidenceSnapshot(item.metadata || {}),
    updated_at: item.updated_at || null,
  };
}

function gateProjection(gate) {
  return {
    id: gate.id || null,
    gate_key: gate.gate_key || null,
    label: gate.label || null,
    state: gate.state || null,
    required: gate.required !== false,
    detail: gate.detail || null,
    evidence: sanitizeControlTowerEvidenceSnapshot(gate.evidence || {}),
    checked_at: gate.checked_at || null,
    updated_at: gate.updated_at || null,
  };
}

function liveProjection(liveStatus) {
  if (!liveStatus) return null;
  return {
    repository: liveStatus.repository || null,
    github_main_sha: liveStatus.github?.mainSha || null,
    github_ci_state: liveStatus.github?.ciState || "unknown",
    github_check_runs_total: liveStatus.github?.checkRunsTotal ?? null,
    github_check_runs_failed: liveStatus.github?.checkRunsFailed ?? null,
    github_check_runs_pending: liveStatus.github?.checkRunsPending ?? null,
    runtime_sha: liveStatus.runtime?.commitSha || null,
    runtime_environment: liveStatus.runtime?.environment || "unknown",
    runtime_branch: liveStatus.runtime?.branch || null,
    deployment_url: liveStatus.runtime?.deploymentUrl || null,
    production_url: liveStatus.runtime?.productionUrl || null,
    supabase_configured: Boolean(liveStatus.runtime?.supabaseConfigured),
    exact_sha: Boolean(liveStatus.releaseTruth?.exactSha),
    production_verified: Boolean(liveStatus.releaseTruth?.productionVerified),
    release_truth_state: liveStatus.releaseTruth?.state || "unknown",
  };
}

export function buildControlTowerReleaseSnapshot({
  release,
  workstreams = [],
  items = [],
  gates = [],
  scorecard = null,
  liveStatus = null,
}) {
  const snapshot = {
    schema: "laneriq.control-tower.release-snapshot.v1",
    release: releaseProjection(release),
    workstreams: sortBy(workstreams, (item) => item.workstream_key || item.id).map(workstreamProjection),
    items: sortBy(items, (item) => item.id).map(itemProjection),
    gates: sortBy(gates, (item) => item.gate_key || item.id).map(gateProjection),
    readiness: scorecard ? {
      overall: scorecard.overall,
      dimensions: scorecard.dimensions,
      gateCoverage: scorecard.gateCoverage,
      hardBlockers: scorecard.hardBlockers,
      productionBlockers: scorecard.productionBlockers,
      rcEligible: scorecard.rcEligible,
      productionEligible: scorecard.productionEligible,
    } : null,
    live: liveProjection(liveStatus),
  };

  return {
    capturedAt: new Date().toISOString(),
    hashAlgorithm: "sha256",
    snapshotHash: hashControlTowerSnapshot(snapshot),
    snapshot,
  };
}

export function evaluateControlTowerProductionDrift(productionTruth, liveStatus) {
  const current = liveProjection(liveStatus) || {};
  const stored = productionTruth && typeof productionTruth === "object" ? productionTruth : {};
  const fields = [
    ["github_main_sha", stored.github_main_sha, current.github_main_sha],
    ["github_ci_state", stored.github_ci_state, current.github_ci_state],
    ["runtime_sha", stored.runtime_sha, current.runtime_sha],
    ["runtime_environment", stored.runtime_environment, current.runtime_environment],
    ["runtime_branch", stored.runtime_branch, current.runtime_branch],
    ["supabase_configured", Boolean(stored.supabase_configured), Boolean(current.supabase_configured)],
    ["exact_sha", Boolean(stored.exact_sha), Boolean(current.exact_sha)],
    ["production_verified", Boolean(stored.production_verified), Boolean(current.production_verified)],
  ];

  const mismatches = fields
    .filter(([, expected, actual]) => expected !== actual)
    .map(([field, expected, actual]) => ({ field, expected: expected ?? null, actual: actual ?? null }));

  return {
    baselineAvailable: Object.keys(stored).length > 0,
    drifted: mismatches.length > 0,
    mismatches,
    current,
  };
}
