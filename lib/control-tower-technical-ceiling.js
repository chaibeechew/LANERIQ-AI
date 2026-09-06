import { evaluateControlTowerMachineEvidenceSemantics } from "./control-tower-evidence-semantics.js";
import { evaluateControlTowerEvidenceTrust } from "./control-tower-evidence-trust.js";
import { computeControlTowerOperationalResilience } from "./control-tower-resilience.js";

const MINUTE = 60 * 1000;
const MAX_FUTURE_SKEW_MINUTES = 5;

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoMs(value) {
  const text = clean(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function evidenceKind(item) {
  return clean(item?.metadata?.kind)?.toLowerCase() || null;
}

function evidenceCapturedAt(item) {
  return clean(item?.metadata?.captured_at) || clean(item?.updated_at) || clean(item?.created_at);
}

function latestEvidence(items, kind) {
  return items
    .filter((item) => String(item?.item_type || "").toLowerCase() === "evidence" && evidenceKind(item) === kind)
    .sort((a, b) => (isoMs(evidenceCapturedAt(b)) || 0) - (isoMs(evidenceCapturedAt(a)) || 0))[0] || null;
}

function freshness(item, maxAgeMinutes, now) {
  if (!item) return { state: "missing", fresh: false, ageMinutes: null, maxAgeMinutes };
  const capturedMs = isoMs(evidenceCapturedAt(item));
  const nowMs = isoMs(now) ?? Date.now();
  if (!capturedMs) return { state: "invalid", fresh: false, ageMinutes: null, maxAgeMinutes };
  const deltaMinutes = (nowMs - capturedMs) / MINUTE;
  if (deltaMinutes < -MAX_FUTURE_SKEW_MINUTES) {
    return { state: "invalid", fresh: false, ageMinutes: Math.round(deltaMinutes), maxAgeMinutes };
  }
  const ageMinutes = Math.max(0, Math.round(deltaMinutes));
  return {
    state: ageMinutes <= maxAgeMinutes ? "fresh" : "stale",
    fresh: ageMinutes <= maxAgeMinutes,
    ageMinutes,
    maxAgeMinutes,
  };
}

function bool(value) {
  return value === true || String(value || "").toLowerCase() === "true" || String(value || "").toLowerCase() === "pass";
}

export function evaluateControlTowerDisasterRecovery({
  items = [],
  now = new Date().toISOString(),
  targetRtoMinutes = 30,
  targetRpoMinutes = 15,
} = {}) {
  const backup = latestEvidence(items, "backup_restore");
  const chaos = latestEvidence(items, "chaos_drill");
  const backupFreshness = freshness(backup, 7 * 24 * 60, now);
  const chaosFreshness = freshness(chaos, 14 * 24 * 60, now);
  const backupSnapshot = backup?.metadata?.snapshot || {};
  const chaosSnapshot = chaos?.metadata?.snapshot || {};
  const restoreMinutes = finite(backupSnapshot.restore_minutes ?? backupSnapshot.restoreMinutes);
  const rpoMinutes = finite(backupSnapshot.rpo_minutes ?? backupSnapshot.rpoMinutes);
  const recoveryMinutes = finite(chaosSnapshot.recovery_minutes ?? chaosSnapshot.recoveryMinutes);

  const backupRestored = bool(backupSnapshot.restore_succeeded ?? backupSnapshot.restoreSucceeded ?? backupSnapshot.restored);
  const chaosSucceeded = bool(chaosSnapshot.success ?? chaosSnapshot.failover_succeeded ?? chaosSnapshot.failoverSucceeded);
  const rtoMet = restoreMinutes !== null && restoreMinutes >= 0 && restoreMinutes <= targetRtoMinutes;
  const rpoMet = rpoMinutes !== null && rpoMinutes >= 0 && rpoMinutes <= targetRpoMinutes;
  const chaosRtoMet = recoveryMinutes !== null && recoveryMinutes >= 0 && recoveryMinutes <= targetRtoMinutes;

  const checks = [
    { key: "backup_fresh", pass: backupFreshness.fresh },
    { key: "backup_restore", pass: backupRestored },
    { key: "backup_rto", pass: rtoMet },
    { key: "backup_rpo", pass: rpoMet },
    { key: "chaos_fresh", pass: chaosFreshness.fresh },
    { key: "chaos_success", pass: chaosSucceeded },
    { key: "chaos_rto", pass: chaosRtoMet },
  ];
  const passed = checks.filter((check) => check.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    ready: passed === checks.length,
    score,
    targetRtoMinutes,
    targetRpoMinutes,
    backup: {
      freshness: backupFreshness,
      restored: backupRestored,
      restoreMinutes,
      rpoMinutes,
      rtoMet,
      rpoMet,
    },
    chaos: {
      freshness: chaosFreshness,
      succeeded: chaosSucceeded,
      recoveryMinutes,
      rtoMet: chaosRtoMet,
    },
    failedChecks: checks.filter((check) => !check.pass).map((check) => check.key),
  };
}

export function evaluateControlTowerSupplyChain({ items = [], now = new Date().toISOString() } = {}) {
  const item = latestEvidence(items, "supply_chain");
  const fresh = freshness(item, 24 * 60, now);
  const snapshot = item?.metadata?.snapshot || {};
  const critical = finite(snapshot.critical_vulnerabilities ?? snapshot.criticalVulnerabilities);
  const high = finite(snapshot.high_vulnerabilities ?? snapshot.highVulnerabilities);
  const sbomVerified = bool(snapshot.sbom_verified ?? snapshot.sbomVerified ?? snapshot.sbom);
  const provenanceVerified = bool(snapshot.provenance_verified ?? snapshot.provenanceVerified);
  const lockVerified = bool(snapshot.dependency_lock_verified ?? snapshot.dependencyLockVerified ?? snapshot.lockfile_verified);
  const noCritical = critical !== null && critical === 0;
  const noHigh = high !== null && high === 0;
  const checks = [fresh.fresh, sbomVerified, provenanceVerified, lockVerified, noCritical, noHigh];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return {
    ready: checks.every(Boolean),
    score,
    freshness: fresh,
    sbomVerified,
    provenanceVerified,
    dependencyLockVerified: lockVerified,
    criticalVulnerabilities: critical,
    highVulnerabilities: high,
  };
}

export function evaluateControlTowerObservability({ items = [], now = new Date().toISOString() } = {}) {
  const item = latestEvidence(items, "observability");
  const fresh = freshness(item, 6 * 60, now);
  const snapshot = item?.metadata?.snapshot || {};
  const metrics = bool(snapshot.metrics);
  const logs = bool(snapshot.logs);
  const traces = bool(snapshot.traces);
  const alerting = bool(snapshot.alerting);
  const synthetic = bool(snapshot.synthetic_checks ?? snapshot.syntheticChecks);
  const checks = [fresh.fresh, metrics, logs, traces, alerting, synthetic];
  return {
    ready: checks.every(Boolean),
    score: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    freshness: fresh,
    metrics,
    logs,
    traces,
    alerting,
    syntheticChecks: synthetic,
  };
}

export function evaluateControlTowerCapacity({ items = [], now = new Date().toISOString(), minimumHeadroomRatio = 1.5 } = {}) {
  const item = latestEvidence(items, "capacity");
  const fresh = freshness(item, 24 * 60, now);
  const snapshot = item?.metadata?.snapshot || {};
  const headroomRatio = finite(snapshot.headroom_ratio ?? snapshot.headroomRatio);
  const queueHeadroomRatio = finite(snapshot.queue_headroom_ratio ?? snapshot.queueHeadroomRatio);
  const providerFailoverReady = bool(snapshot.provider_failover_ready ?? snapshot.providerFailoverReady);
  const headroomReady = headroomRatio !== null && headroomRatio >= minimumHeadroomRatio;
  const queueReady = queueHeadroomRatio !== null && queueHeadroomRatio >= 1.25;
  const checks = [fresh.fresh, headroomReady, queueReady, providerFailoverReady];
  return {
    ready: checks.every(Boolean),
    score: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    freshness: fresh,
    minimumHeadroomRatio,
    headroomRatio,
    queueHeadroomRatio,
    providerFailoverReady,
  };
}

function openCriticalItems(items = []) {
  return items.filter((item) => {
    const priority = String(item?.priority || "").toLowerCase();
    const stage = String(item?.stage || "").toLowerCase();
    return ["p0", "p1"].includes(priority) && stage !== "closed" && String(item?.item_type || "").toLowerCase() !== "evidence";
  });
}

export function computeControlTowerTechnicalCeiling({
  release,
  items = [],
  gates = [],
  liveStatus = null,
  now = new Date().toISOString(),
} = {}) {
  const operational = computeControlTowerOperationalResilience({ release, items, gates, liveStatus, now });
  const evidenceTrust = evaluateControlTowerEvidenceTrust({ items, liveStatus });
  const evidenceSemantics = evaluateControlTowerMachineEvidenceSemantics({ items, liveStatus });
  const disasterRecovery = evaluateControlTowerDisasterRecovery({ items, now });
  const supplyChain = evaluateControlTowerSupplyChain({ items, now });
  const observability = evaluateControlTowerObservability({ items, now });
  const capacity = evaluateControlTowerCapacity({ items, now });
  const criticalItems = openCriticalItems(items);
  const governanceScore = criticalItems.length === 0 ? 100 : clamp(100 - criticalItems.length * 35, 0, 100);

  const blockers = [];
  if (!operational.technicalCeilingEligible) blockers.push("Operational resilience is below technical-ceiling policy.");
  if (!evidenceTrust.healthy) blockers.push("Trusted machine evidence is incomplete or not bound to the verified release SHA.");
  if (!evidenceSemantics.healthy) blockers.push("Trusted machine evidence contains failing, incomplete, or ambiguous outcomes.");
  if (!disasterRecovery.ready) blockers.push("Disaster recovery / chaos readiness is incomplete.");
  if (!supplyChain.ready) blockers.push("Software supply-chain proof is incomplete.");
  if (!observability.ready) blockers.push("Observability proof is incomplete.");
  if (!capacity.ready) blockers.push("Capacity / provider failover headroom is incomplete.");
  if (criticalItems.length) blockers.push(`${criticalItems.length} open P0/P1 governance item(s) remain.`);

  const overall = Math.round(
    operational.overall * 0.2 +
    evidenceTrust.score * 0.1 +
    evidenceSemantics.score * 0.1 +
    disasterRecovery.score * 0.15 +
    supplyChain.score * 0.15 +
    observability.score * 0.15 +
    capacity.score * 0.1 +
    governanceScore * 0.05,
  );

  return {
    overall,
    technicalCeilingEligible: overall === 100 && blockers.length === 0,
    blockers,
    dimensions: {
      operational,
      evidenceTrust,
      evidenceSemantics,
      disasterRecovery,
      supplyChain,
      observability,
      capacity,
      governance: {
        score: governanceScore,
        openCriticalItems: criticalItems.map((item) => ({
          id: item.id || null,
          title: item.title || "Untitled",
          priority: item.priority || null,
          stage: item.stage || null,
        })),
      },
    },
  };
}
