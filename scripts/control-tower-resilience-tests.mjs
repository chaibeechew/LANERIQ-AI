import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildControlTowerReleaseAttestation,
  computeControlTowerOperationalResilience,
  evaluateControlTowerEvidenceFreshness,
  evaluateControlTowerSloBudget,
  selectControlTowerRollbackCandidate,
} from "../lib/control-tower-resilience.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = fs.readFileSync(path.join(root, "app/api/admin/control-tower/resilience/route.js"), "utf8");

assert.match(route, /getControlTowerAuthContext/);
assert.match(route, /computeControlTowerOperationalResilience/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.match(route, /Referrer-Policy/);

const now = "2026-09-07T00:00:00.000Z";
const MAIN_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREVIOUS_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BAD_SHA = "cccccccccccccccccccccccccccccccccccccccc";
const fingerprint = (label) => createHash("sha256").update(String(label)).digest("hex");
const evidenceItem = (kind, capturedAt, fingerprintLabel, snapshot = {}, metadata = {}) => ({
  item_type: "evidence",
  metadata: {
    kind,
    captured_at: capturedAt,
    fingerprint: fingerprintLabel === null ? null : fingerprint(fingerprintLabel),
    snapshot,
    ...metadata,
  },
});

const items = [
  evidenceItem("github_ci", "2026-09-06T23:45:00.000Z", "ci-1", { state: "success" }),
  evidenceItem("security", "2026-09-06T22:00:00.000Z", "sec-1", { critical: 0 }),
  evidenceItem("benchmark", "2026-09-06T23:00:00.000Z", "bench-1", {
    slo: { availabilityTarget: 0.999, windowMinutes: 43200, badMinutes: 0 },
  }),
  evidenceItem("supabase_migration", "2026-09-06T23:00:00.000Z", "db-1", { verified: true }),
  evidenceItem("vercel_deployment", "2026-09-06T23:50:00.000Z", "dpl-current", {
    sha: MAIN_SHA,
    environment: "production",
    state: "ready",
    healthy: true,
    verified: true,
  }),
  evidenceItem("vercel_deployment", "2026-09-06T20:00:00.000Z", "dpl-rollback", {
    sha: PREVIOUS_SHA,
    environment: "production",
    state: "ready",
    healthy: true,
    verified: true,
  }),
];

const freshness = evaluateControlTowerEvidenceFreshness({ items, phase: "production", now });
assert.equal(freshness.healthy, true);
assert.equal(freshness.score, 100);
assert.deepEqual(freshness.missing, []);
assert.deepEqual(freshness.stale, []);
assert.deepEqual(freshness.invalid, []);

const staleFreshness = evaluateControlTowerEvidenceFreshness({
  items: items.map((item) =>
    item.metadata.kind === "github_ci"
      ? evidenceItem("github_ci", "2026-09-05T00:00:00.000Z", "ci-old")
      : item,
  ),
  phase: "production",
  now,
});
assert.equal(staleFreshness.healthy, false);
assert.ok(staleFreshness.stale.includes("github_ci"));

const unsignedFreshness = evaluateControlTowerEvidenceFreshness({
  items: items.map((item) =>
    item.metadata.kind === "security"
      ? evidenceItem("security", "2026-09-06T22:00:00.000Z", null, { critical: 0 })
      : item,
  ),
  phase: "production",
  now,
});
assert.equal(unsignedFreshness.healthy, false);
assert.ok(unsignedFreshness.invalid.includes("security"));

const malformedFingerprint = items.map((item) => item.metadata.kind === "security"
  ? { ...item, metadata: { ...item.metadata, fingerprint: "abc123" } }
  : item);
const malformedFreshness = evaluateControlTowerEvidenceFreshness({ items: malformedFingerprint, phase: "production", now });
assert.equal(malformedFreshness.healthy, false);
assert.ok(malformedFreshness.invalid.includes("security"));

const futureFreshness = evaluateControlTowerEvidenceFreshness({
  items: items.map((item) =>
    item.metadata.kind === "github_ci"
      ? evidenceItem("github_ci", "2026-09-07T02:00:00.000Z", "ci-future", { state: "success" })
      : item,
  ),
  phase: "production",
  now,
});
assert.equal(futureFreshness.healthy, false);
assert.ok(futureFreshness.invalid.includes("github_ci"));

const healthyBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 0.999,
  windowMinutes: 43200,
  badMinutes: 0,
});
assert.equal(healthyBudget.healthy, true);
assert.equal(healthyBudget.state, "healthy");
assert.equal(healthyBudget.score, 100);

const exhaustedBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 0.999,
  windowMinutes: 43200,
  badMinutes: 60,
});
assert.equal(exhaustedBudget.healthy, false);
assert.equal(exhaustedBudget.state, "exhausted");
assert.ok(exhaustedBudget.burnRate > 1);

const missingBudget = evaluateControlTowerSloBudget({});
assert.equal(missingBudget.healthy, false);
assert.equal(missingBudget.state, "missing");

const partialRequestBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 0.999,
  windowMinutes: 43200,
  requests: 1000,
});
assert.equal(partialRequestBudget.healthy, false);
assert.equal(partialRequestBudget.state, "missing");
assert.equal(partialRequestBudget.errorRate, null);

const negativeBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 0.999,
  windowMinutes: 43200,
  badMinutes: -1,
});
assert.equal(negativeBudget.healthy, false);
assert.equal(negativeBudget.state, "invalid");
assert.equal(negativeBudget.reason, "negative_bad_minutes");

const impossibleRequestBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 0.999,
  windowMinutes: 43200,
  requests: 10,
  errors: 11,
});
assert.equal(impossibleRequestBudget.healthy, false);
assert.equal(impossibleRequestBudget.state, "invalid");
assert.equal(impossibleRequestBudget.reason, "errors_exceed_requests");

const invalidTargetBudget = evaluateControlTowerSloBudget({
  availabilityTarget: 1.2,
  windowMinutes: 43200,
  badMinutes: 0,
});
assert.equal(invalidTargetBudget.healthy, false);
assert.equal(invalidTargetBudget.state, "invalid");
assert.equal(invalidTargetBudget.reason, "invalid_availability_target");

const rollback = selectControlTowerRollbackCandidate({
  currentSha: MAIN_SHA,
  now,
  deployments: [
    { sha: MAIN_SHA, environment: "production", state: "ready", healthy: true, verified: true, capturedAt: now },
    { sha: PREVIOUS_SHA, environment: "production", state: "ready", healthy: true, verified: true, capturedAt: "2026-09-06T20:00:00.000Z" },
    { sha: BAD_SHA, environment: "production", state: "ready", healthy: false, verified: true, capturedAt: "2026-09-06T21:00:00.000Z" },
  ],
});
assert.equal(rollback.ready, true);
assert.equal(rollback.candidate?.sha, PREVIOUS_SHA);
assert.ok(rollback.candidate?.ageMinutes >= 0);

const noRollback = selectControlTowerRollbackCandidate({
  currentSha: MAIN_SHA,
  now,
  deployments: [{ sha: MAIN_SHA, environment: "production", state: "ready", healthy: true, verified: true, capturedAt: now }],
});
assert.equal(noRollback.ready, false);

const malformedRollback = selectControlTowerRollbackCandidate({
  currentSha: MAIN_SHA,
  now,
  deployments: [{ sha: "not-a-git-sha", environment: "production", state: "ready", healthy: true, verified: true, capturedAt: "2026-09-06T20:00:00.000Z" }],
});
assert.equal(malformedRollback.ready, false);

const staleRollback = selectControlTowerRollbackCandidate({
  currentSha: MAIN_SHA,
  now,
  deployments: [{
    sha: PREVIOUS_SHA,
    environment: "production",
    state: "ready",
    healthy: true,
    verified: true,
    capturedAt: "2026-07-01T00:00:00.000Z",
  }],
});
assert.equal(staleRollback.ready, false);

const futureRollback = selectControlTowerRollbackCandidate({
  currentSha: MAIN_SHA,
  now,
  deployments: [{
    sha: PREVIOUS_SHA,
    environment: "production",
    state: "ready",
    healthy: true,
    verified: true,
    capturedAt: "2026-09-07T02:00:00.000Z",
  }],
});
assert.equal(futureRollback.ready, false);

const liveStatus = {
  github: { mainSha: MAIN_SHA },
  runtime: { commitSha: MAIN_SHA, environment: "production" },
  releaseTruth: { exactSha: true, productionVerified: true },
};
const release = { id: "release-1", product_version: "LANERIQ AI", release_version: "v-next", stage: "production" };
const gates = [
  { gate_key: "ci", required: true, state: "pass", checked_at: "2026-09-06T23:55:00.000Z" },
  { gate_key: "security", required: true, state: "pass", checked_at: "2026-09-06T23:55:00.000Z" },
];

const attestationA = buildControlTowerReleaseAttestation({ release, gates, items, liveStatus });
const attestationB = buildControlTowerReleaseAttestation({
  release,
  gates: [...gates].reverse(),
  items: [...items].reverse(),
  liveStatus,
});
assert.equal(attestationA.algorithm, "sha256");
assert.equal(attestationA.digest.length, 64);
assert.equal(attestationA.digest, attestationB.digest);

const changedAttestation = buildControlTowerReleaseAttestation({
  release: { ...release, release_version: "v-next-2" },
  gates,
  items,
  liveStatus,
});
assert.notEqual(attestationA.digest, changedAttestation.digest);

const trustChangedAttestation = buildControlTowerReleaseAttestation({
  release,
  gates,
  items: items.map((item) => item.metadata.kind === "security"
    ? { ...item, metadata: { ...item.metadata, trust_level: "system", source_provider: "security-scanner", subject_sha: MAIN_SHA } }
    : item),
  liveStatus,
});
assert.notEqual(attestationA.digest, trustChangedAttestation.digest);

const ceiling = computeControlTowerOperationalResilience({ release, items, gates, liveStatus, now });
assert.equal(ceiling.evidence.healthy, true);
assert.equal(ceiling.slo.healthy, true);
assert.equal(ceiling.rollback.ready, true);
assert.equal(ceiling.productionTruth, true);
assert.equal(ceiling.overall, 100);
assert.equal(ceiling.resilient, true);
assert.equal(ceiling.technicalCeilingEligible, true);
assert.deepEqual(ceiling.blockers, []);

const blocked = computeControlTowerOperationalResilience({
  release,
  items: items.filter((item) => item.metadata.kind !== "security" && item.metadata.fingerprint !== fingerprint("dpl-rollback")),
  gates,
  liveStatus: {
    ...liveStatus,
    releaseTruth: { exactSha: false, productionVerified: false },
  },
  now,
});
assert.equal(blocked.resilient, false);
assert.equal(blocked.technicalCeilingEligible, false);
assert.ok(blocked.blockers.length >= 3);

console.log("Control Tower resilience tests passed.");
