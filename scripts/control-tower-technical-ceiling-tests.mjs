import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateControlTowerEvidenceTrust } from "../lib/control-tower-evidence-trust.js";
import {
  computeControlTowerTechnicalCeiling,
  evaluateControlTowerCapacity,
  evaluateControlTowerDisasterRecovery,
  evaluateControlTowerObservability,
  evaluateControlTowerSupplyChain,
} from "../lib/control-tower-technical-ceiling.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = fs.readFileSync(path.join(root, "app/api/admin/control-tower/technical-ceiling/route.js"), "utf8");
const evidenceSource = fs.readFileSync(path.join(root, "lib/control-tower-evidence.js"), "utf8");
const evidenceRoute = fs.readFileSync(path.join(root, "app/api/admin/control-tower/evidence/route.js"), "utf8");
const trustMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260906204400_admin_control_tower_evidence_trust.sql"), "utf8");

assert.match(route, /getControlTowerAuthContext/);
assert.match(route, /computeControlTowerTechnicalCeiling/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.match(route, /Referrer-Policy/);
assert.match(evidenceRoute, /sealControlTowerHumanEvidence/);
assert.match(evidenceRoute, /AUTOMATED_EVIDENCE_REQUIRED/);
assert.match(trustMigration, /evidence is append-only and immutable/i);
assert.match(trustMigration, /System evidence requires service-role execution/);
assert.match(trustMigration, /Human evidence cannot satisfy machine evidence kind/);
for (const kind of ["backup_restore", "chaos_drill", "supply_chain", "observability", "capacity", "incident"]) {
  assert.match(evidenceSource, new RegExp(`"${kind}"`));
}

const now = "2026-09-07T00:00:00.000Z";
const MAIN_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREVIOUS_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER_SHA = "cccccccccccccccccccccccccccccccccccccccc";
const providers = {
  github_ci: "github-actions",
  security: "security-scanner",
  benchmark: "benchmark-runner",
  vercel_deployment: "vercel",
  supabase_migration: "supabase",
  backup_restore: "backup-drill",
  chaos_drill: "chaos-runner",
  supply_chain: "supply-chain",
  observability: "observability",
  capacity: "capacity-probe",
};
const releaseBound = new Set(["github_ci", "security", "benchmark", "vercel_deployment", "supply_chain"]);

const evidence = (kind, capturedAt, fingerprint, snapshot = {}, options = {}) => ({
  item_type: "evidence",
  stage: "verification",
  priority: "p2",
  metadata: {
    kind,
    captured_at: capturedAt,
    fingerprint,
    snapshot,
    trust_level: options.trustLevel || "system",
    source_provider: options.sourceProvider || providers[kind] || "control-tower",
    subject_sha: Object.prototype.hasOwnProperty.call(options, "subjectSha")
      ? options.subjectSha
      : releaseBound.has(kind) ? MAIN_SHA : null,
  },
});

const items = [
  evidence("github_ci", "2026-09-06T23:45:00.000Z", "ci", { state: "success" }),
  evidence("security", "2026-09-06T22:00:00.000Z", "security", { critical: 0 }),
  evidence("benchmark", "2026-09-06T23:00:00.000Z", "benchmark", {
    slo: { availabilityTarget: 0.999, windowMinutes: 43200, badMinutes: 0 },
  }),
  evidence("supabase_migration", "2026-09-06T22:30:00.000Z", "database", { verified: true }),
  evidence("vercel_deployment", "2026-09-06T23:50:00.000Z", "current", {
    sha: MAIN_SHA, environment: "production", state: "ready", healthy: true, verified: true,
  }),
  evidence("vercel_deployment", "2026-09-06T20:00:00.000Z", "rollback", {
    sha: PREVIOUS_SHA, environment: "production", state: "ready", healthy: true, verified: true,
  }, { subjectSha: PREVIOUS_SHA }),
  evidence("backup_restore", "2026-09-05T12:00:00.000Z", "backup", {
    restore_succeeded: true,
    restore_minutes: 12,
    rpo_minutes: 5,
  }),
  evidence("chaos_drill", "2026-09-04T12:00:00.000Z", "chaos", {
    success: true,
    recovery_minutes: 8,
  }),
  evidence("supply_chain", "2026-09-06T23:00:00.000Z", "supply", {
    sbom_verified: true,
    provenance_verified: true,
    dependency_lock_verified: true,
    critical_vulnerabilities: 0,
    high_vulnerabilities: 0,
  }),
  evidence("observability", "2026-09-06T23:30:00.000Z", "observe", {
    metrics: true,
    logs: true,
    traces: true,
    alerting: true,
    synthetic_checks: true,
  }),
  evidence("capacity", "2026-09-06T22:00:00.000Z", "capacity", {
    headroom_ratio: 2,
    queue_headroom_ratio: 1.5,
    provider_failover_ready: true,
  }),
];

const liveStatus = {
  github: { mainSha: MAIN_SHA },
  runtime: { commitSha: MAIN_SHA, environment: "production" },
  releaseTruth: { exactSha: true, productionVerified: true },
};

const trust = evaluateControlTowerEvidenceTrust({ items, liveStatus });
assert.equal(trust.healthy, true);
assert.equal(trust.score, 100);
assert.equal(trust.exactRuntimeIdentity, true);
assert.deepEqual(trust.missing, []);
assert.deepEqual(trust.untrusted, []);

const dr = evaluateControlTowerDisasterRecovery({ items, now });
assert.equal(dr.ready, true);
assert.equal(dr.score, 100);
assert.equal(dr.backup.rtoMet, true);
assert.equal(dr.backup.rpoMet, true);
assert.equal(dr.chaos.rtoMet, true);

const supplyChain = evaluateControlTowerSupplyChain({ items, now });
assert.equal(supplyChain.ready, true);
assert.equal(supplyChain.score, 100);
assert.equal(supplyChain.criticalVulnerabilities, 0);
assert.equal(supplyChain.highVulnerabilities, 0);

const observability = evaluateControlTowerObservability({ items, now });
assert.equal(observability.ready, true);
assert.equal(observability.score, 100);

const capacity = evaluateControlTowerCapacity({ items, now });
assert.equal(capacity.ready, true);
assert.equal(capacity.score, 100);

const release = {
  id: "release-1",
  product_version: "LANERIQ AI",
  release_version: "v-next",
  stage: "production",
};
const gates = [
  { gate_key: "ci", required: true, state: "pass", checked_at: "2026-09-06T23:55:00.000Z" },
  { gate_key: "security", required: true, state: "pass", checked_at: "2026-09-06T23:55:00.000Z" },
];

const ceiling = computeControlTowerTechnicalCeiling({ release, items, gates, liveStatus, now });
assert.equal(ceiling.overall, 100);
assert.equal(ceiling.technicalCeilingEligible, true);
assert.deepEqual(ceiling.blockers, []);
assert.equal(ceiling.dimensions.operational.technicalCeilingEligible, true);
assert.equal(ceiling.dimensions.evidenceTrust.healthy, true);
assert.equal(ceiling.dimensions.evidenceTrust.score, 100);
assert.equal(ceiling.dimensions.disasterRecovery.ready, true);
assert.equal(ceiling.dimensions.supplyChain.ready, true);
assert.equal(ceiling.dimensions.observability.ready, true);
assert.equal(ceiling.dimensions.capacity.ready, true);
assert.equal(ceiling.dimensions.governance.score, 100);

const withHumanSpoof = computeControlTowerTechnicalCeiling({
  release,
  items: items.map((item) => item.metadata.kind === "security"
    ? evidence("security", "2026-09-06T22:00:00.000Z", "security-human", { critical: 0 }, {
      trustLevel: "human",
      sourceProvider: "control-tower-api",
      subjectSha: null,
    })
    : item),
  gates,
  liveStatus,
  now,
});
assert.equal(withHumanSpoof.technicalCeilingEligible, false);
assert.ok(withHumanSpoof.blockers.some((blocker) => blocker.includes("Trusted machine evidence")));
assert.ok(withHumanSpoof.dimensions.evidenceTrust.untrusted.some((entry) => entry.kind === "security"));

const withShaMismatch = computeControlTowerTechnicalCeiling({
  release,
  items: items.map((item) => item.metadata.kind === "supply_chain"
    ? evidence("supply_chain", "2026-09-06T23:00:00.000Z", "supply-other-sha", item.metadata.snapshot, { subjectSha: OTHER_SHA })
    : item),
  gates,
  liveStatus,
  now,
});
assert.equal(withShaMismatch.technicalCeilingEligible, false);
assert.ok(withShaMismatch.dimensions.evidenceTrust.untrusted.some((entry) => entry.kind === "supply_chain" && entry.reason === "subject_sha_mismatch"));

const withoutExactRuntime = computeControlTowerTechnicalCeiling({
  release,
  items,
  gates,
  liveStatus: {
    ...liveStatus,
    runtime: { ...liveStatus.runtime, commitSha: OTHER_SHA },
    releaseTruth: { exactSha: false, productionVerified: false },
  },
  now,
});
assert.equal(withoutExactRuntime.technicalCeilingEligible, false);
assert.equal(withoutExactRuntime.dimensions.evidenceTrust.exactRuntimeIdentity, false);

const withCriticalRisk = computeControlTowerTechnicalCeiling({
  release,
  items: [...items, { id: "risk-1", item_type: "risk", title: "Critical risk", priority: "p0", stage: "verification" }],
  gates,
  liveStatus,
  now,
});
assert.equal(withCriticalRisk.technicalCeilingEligible, false);
assert.ok(withCriticalRisk.blockers.some((blocker) => blocker.includes("P0/P1")));

const brokenDr = evaluateControlTowerDisasterRecovery({
  items: items.filter((item) => item.metadata.kind !== "chaos_drill"),
  now,
});
assert.equal(brokenDr.ready, false);
assert.ok(brokenDr.failedChecks.includes("chaos_fresh"));

const missingRecoveryMetrics = evaluateControlTowerDisasterRecovery({
  items: items.map((item) => item.metadata.kind === "backup_restore"
    ? evidence("backup_restore", "2026-09-05T12:00:00.000Z", "backup-missing", { restore_succeeded: true })
    : item),
  now,
});
assert.equal(missingRecoveryMetrics.ready, false);
assert.equal(missingRecoveryMetrics.backup.restoreMinutes, null);
assert.equal(missingRecoveryMetrics.backup.rpoMinutes, null);
assert.equal(missingRecoveryMetrics.backup.rtoMet, false);
assert.equal(missingRecoveryMetrics.backup.rpoMet, false);

const missingSupplyMetrics = evaluateControlTowerSupplyChain({
  items: items.map((item) => item.metadata.kind === "supply_chain"
    ? evidence("supply_chain", "2026-09-06T23:00:00.000Z", "supply-missing", {
      sbom_verified: true,
      provenance_verified: true,
      dependency_lock_verified: true,
    })
    : item),
  now,
});
assert.equal(missingSupplyMetrics.ready, false);
assert.equal(missingSupplyMetrics.criticalVulnerabilities, null);
assert.equal(missingSupplyMetrics.highVulnerabilities, null);

const staleObservability = evaluateControlTowerObservability({
  items: items.map((item) => item.metadata.kind === "observability"
    ? evidence("observability", "2026-09-05T00:00:00.000Z", "observe-old", item.metadata.snapshot)
    : item),
  now,
});
assert.equal(staleObservability.ready, false);
assert.equal(staleObservability.freshness.state, "stale");

const futureObservability = evaluateControlTowerObservability({
  items: items.map((item) => item.metadata.kind === "observability"
    ? evidence("observability", "2026-09-07T02:00:00.000Z", "observe-future", item.metadata.snapshot)
    : item),
  now,
});
assert.equal(futureObservability.ready, false);
assert.equal(futureObservability.freshness.state, "invalid");

const weakCapacity = evaluateControlTowerCapacity({
  items: items.map((item) => item.metadata.kind === "capacity"
    ? evidence("capacity", "2026-09-06T22:00:00.000Z", "capacity-low", {
      headroom_ratio: 1.1,
      queue_headroom_ratio: 1.1,
      provider_failover_ready: false,
    })
    : item),
  now,
});
assert.equal(weakCapacity.ready, false);
assert.ok(weakCapacity.score < 100);

const missingCapacityMetrics = evaluateControlTowerCapacity({
  items: items.map((item) => item.metadata.kind === "capacity"
    ? evidence("capacity", "2026-09-06T22:00:00.000Z", "capacity-missing", { provider_failover_ready: true })
    : item),
  now,
});
assert.equal(missingCapacityMetrics.ready, false);
assert.equal(missingCapacityMetrics.headroomRatio, null);
assert.equal(missingCapacityMetrics.queueHeadroomRatio, null);

console.log("Control Tower technical-ceiling tests passed.");
