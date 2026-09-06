import { createHash } from "node:crypto";

export const CONTROL_TOWER_HUMAN_EVIDENCE_KINDS = Object.freeze([
  "manual",
  "screenshot",
  "incident",
  "github_pr",
]);

export const CONTROL_TOWER_MACHINE_EVIDENCE_SOURCES = Object.freeze({
  github_ci: Object.freeze(["github-actions"]),
  vercel_deployment: Object.freeze(["vercel"]),
  supabase_migration: Object.freeze(["supabase"]),
  benchmark: Object.freeze(["benchmark-runner"]),
  security: Object.freeze(["security-scanner"]),
  backup_restore: Object.freeze(["backup-drill"]),
  chaos_drill: Object.freeze(["chaos-runner"]),
  supply_chain: Object.freeze(["supply-chain"]),
  observability: Object.freeze(["observability"]),
  capacity: Object.freeze(["capacity-probe"]),
  release_snapshot: Object.freeze(["control-tower"]),
  production_truth: Object.freeze(["control-tower"]),
  audit_integrity: Object.freeze(["control-tower"]),
});

export const CONTROL_TOWER_TECHNICAL_CEILING_MACHINE_EVIDENCE = Object.freeze([
  "github_ci",
  "security",
  "benchmark",
  "vercel_deployment",
  "supabase_migration",
  "backup_restore",
  "chaos_drill",
  "supply_chain",
  "observability",
  "capacity",
]);

export const CONTROL_TOWER_RELEASE_BOUND_EVIDENCE_KINDS = Object.freeze([
  "github_ci",
  "security",
  "benchmark",
  "vercel_deployment",
  "supply_chain",
]);

const HUMAN_KIND_SET = new Set(CONTROL_TOWER_HUMAN_EVIDENCE_KINDS);
const MACHINE_KIND_SET = new Set(Object.keys(CONTROL_TOWER_MACHINE_EVIDENCE_SOURCES));
const RELEASE_BOUND_KIND_SET = new Set(CONTROL_TOWER_RELEASE_BOUND_EVIDENCE_KINDS);
const SHA40 = /^[0-9a-f]{40}$/i;

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function capturedAt(item) {
  return clean(item?.metadata?.captured_at) || clean(item?.updated_at) || clean(item?.created_at);
}

function capturedMs(item) {
  const value = capturedAt(item);
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function isControlTowerHumanEvidenceKind(kind) {
  return HUMAN_KIND_SET.has(String(kind || "").trim().toLowerCase());
}

export function isControlTowerMachineEvidenceKind(kind) {
  return MACHINE_KIND_SET.has(String(kind || "").trim().toLowerCase());
}

export function sealControlTowerHumanEvidence(value) {
  const kind = String(value?.metadata?.kind || "").trim().toLowerCase();
  if (!isControlTowerHumanEvidenceKind(kind)) {
    return { ok: false, error: "This evidence kind requires a trusted machine collector." };
  }

  const metadata = {
    ...(value?.metadata || {}),
    trust_level: "human",
    source_provider: "control-tower-api",
    subject_sha: null,
  };
  metadata.fingerprint = fingerprint({
    releaseId: value?.release_id || null,
    kind,
    externalRef: value?.external_ref || null,
    snapshot: metadata.snapshot || {},
    trustLevel: metadata.trust_level,
    sourceProvider: metadata.source_provider,
  });

  return { ok: true, value: { ...value, metadata } };
}

export function sealControlTowerSystemEvidence(value, { sourceProvider, subjectSha = null } = {}) {
  const kind = String(value?.metadata?.kind || "").trim().toLowerCase();
  const provider = String(sourceProvider || "").trim().toLowerCase();
  const subject = clean(subjectSha)?.toLowerCase() || null;
  const allowedSources = CONTROL_TOWER_MACHINE_EVIDENCE_SOURCES[kind] || [];

  if (!isControlTowerMachineEvidenceKind(kind)) {
    return { ok: false, error: "Invalid machine evidence kind." };
  }
  if (!allowedSources.includes(provider)) {
    return { ok: false, error: "Evidence source is not trusted for this machine evidence kind." };
  }
  if (RELEASE_BOUND_KIND_SET.has(kind) && !SHA40.test(subject || "")) {
    return { ok: false, error: "Release-bound machine evidence requires a full 40-character Git SHA." };
  }

  const metadata = {
    ...(value?.metadata || {}),
    trust_level: "system",
    source_provider: provider,
    subject_sha: subject,
  };
  metadata.fingerprint = fingerprint({
    releaseId: value?.release_id || null,
    kind,
    externalRef: value?.external_ref || null,
    snapshot: metadata.snapshot || {},
    trustLevel: metadata.trust_level,
    sourceProvider: metadata.source_provider,
    subjectSha: metadata.subject_sha,
  });

  return { ok: true, value: { ...value, metadata } };
}

export function evaluateControlTowerEvidenceTrust({ items = [], liveStatus = null } = {}) {
  const mainSha = clean(liveStatus?.github?.mainSha)?.toLowerCase() || null;
  const runtimeSha = clean(liveStatus?.runtime?.commitSha)?.toLowerCase() || null;
  const exactRuntimeIdentity = Boolean(mainSha && runtimeSha && mainSha === runtimeSha && SHA40.test(mainSha));
  const evidence = items.filter((item) => String(item?.item_type || "").toLowerCase() === "evidence");
  const byKind = new Map();

  for (const item of evidence) {
    const kind = String(item?.metadata?.kind || "").trim().toLowerCase();
    if (!CONTROL_TOWER_TECHNICAL_CEILING_MACHINE_EVIDENCE.includes(kind)) continue;
    const previous = byKind.get(kind);
    if (!previous || capturedMs(item) > capturedMs(previous)) byKind.set(kind, item);
  }

  const details = CONTROL_TOWER_TECHNICAL_CEILING_MACHINE_EVIDENCE.map((kind) => {
    const item = byKind.get(kind);
    if (!item) return { kind, state: "missing", trusted: false, reason: "missing" };

    const trustLevel = String(item?.metadata?.trust_level || "").trim().toLowerCase();
    const sourceProvider = String(item?.metadata?.source_provider || "").trim().toLowerCase();
    const subjectSha = clean(item?.metadata?.subject_sha)?.toLowerCase() || null;
    const allowedSources = CONTROL_TOWER_MACHINE_EVIDENCE_SOURCES[kind] || [];

    if (trustLevel !== "system") {
      return { kind, state: "untrusted", trusted: false, reason: "not_system_collected", trustLevel, sourceProvider, subjectSha };
    }
    if (!allowedSources.includes(sourceProvider)) {
      return { kind, state: "untrusted", trusted: false, reason: "untrusted_source", trustLevel, sourceProvider, subjectSha };
    }
    if (RELEASE_BOUND_KIND_SET.has(kind)) {
      if (!exactRuntimeIdentity) {
        return { kind, state: "untrusted", trusted: false, reason: "runtime_identity_unverified", trustLevel, sourceProvider, subjectSha };
      }
      if (!subjectSha || subjectSha !== mainSha) {
        return { kind, state: "untrusted", trusted: false, reason: "subject_sha_mismatch", trustLevel, sourceProvider, subjectSha };
      }
    }

    return { kind, state: "trusted", trusted: true, reason: null, trustLevel, sourceProvider, subjectSha };
  });

  const trustedCount = details.filter((item) => item.trusted).length;
  return {
    healthy: trustedCount === details.length,
    score: details.length ? Math.round((trustedCount / details.length) * 100) : 0,
    exactRuntimeIdentity,
    required: CONTROL_TOWER_TECHNICAL_CEILING_MACHINE_EVIDENCE,
    missing: details.filter((item) => item.state === "missing").map((item) => item.kind),
    untrusted: details.filter((item) => item.state === "untrusted").map((item) => ({ kind: item.kind, reason: item.reason })),
    details,
  };
}
