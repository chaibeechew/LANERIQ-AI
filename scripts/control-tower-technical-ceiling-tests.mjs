import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

assert.match(route, /getControlTowerAuthContext/);
assert.match(route, /computeControlTowerTechnicalCeiling/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.match(route, /Referrer-Policy/);
for (const kind of ["backup_restore", "chaos_drill", "supply_chain", "observability", "capacity", "incident"]) {
  assert.match(evidenceSource, new RegExp(`"${kind}"`));
}

const now = "2026-09-07T00:00:00.000Z";
const evidence = (kind, capturedAt, fingerprint, snapshot = {}) => ({
  item_type: "evidence",
  stage: "verification",
  priority: "p2",
  metadata: { kind, captured_at: capturedAt, fingerprint, snapshot },
});

const items = [
  evidence("github_ci", "2026-09-06T23:45:00.000Z", "ci", { state: "success" }),
  evidence("security", "2026-09-06T22:00:00.000Z", "security", { critical: 0 }),
  evidence("benchmark", "2026-09-06T23:00:00.000Z", "benchmark", {
    slo: { availabilityTarget: 0.999, windowMinutes: 43200, badMinutes: 0 },
  }),
  evidence("supabase_migration", "2026-09-06T22:30:00.000Z", "database", { verified: true }),
  evidence("vercel_deployment", "2026-09-06T23:50:00.000Z", "current", {
    sha: "main-sha", environment: "production", state: "ready", healthy: true, verified: true,
  }),
  evidence("vercel_deployment", "2026-09-06T20:00:00.000Z", "rollback", {
    sha: "previous-sha", environment: "production", state: "ready", healthy: true, verified: true,
  }),
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
const liveStatus = {
  github: { mainSha: "main-sha" },
  runtime: { commitSha: "main-sha", environment: "production" },
  releaseTruth: { exactSha: true, productionVerified: true },
};

const ceiling = computeControlTowerTechnicalCeiling({ release, items, gates, liveStatus, now });
assert.equal(ceiling.overall, 100);
assert.equal(ceiling.technicalCeilingEligible, true);
assert.deepEqual(ceiling.blockers, []);
assert.equal(ceiling.dimensions.operational.technicalCeilingEligible, true);
assert.equal(ceiling.dimensions.disasterRecovery.ready, true);
assert.equal(ceiling.dimensions.supplyChain.ready, true);
assert.equal(ceiling.dimensions.observability.ready, true);
assert.equal(ceiling.dimensions.capacity.ready, true);
assert.equal(ceiling.dimensions.governance.score, 100);

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

const staleObservability = evaluateControlTowerObservability({
  items: items.map((item) => item.metadata.kind === "observability"
    ? evidence("observability", "2026-09-05T00:00:00.000Z", "observe-old", item.metadata.snapshot)
    : item),
  now,
});
assert.equal(staleObservability.ready, false);
assert.equal(staleObservability.freshness.state, "stale");

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

console.log("Control Tower technical-ceiling tests passed.");
