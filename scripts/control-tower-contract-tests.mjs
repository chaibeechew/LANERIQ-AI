import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  controlTowerRoleFromAppMetadata,
  canPromoteControlTowerProduction,
  canWaiveControlTowerGate,
} from "../lib/admin-access.js";
import { deriveGitHubCiState, evaluateReleaseTruth } from "../lib/control-tower-runtime.js";
import {
  CONTROL_TOWER_STANDARD_GATES,
  analyzeWorkstreamDependencies,
  computeReleaseScorecard,
} from "../lib/control-tower-governance.js";
import {
  canTransitionControlTowerStage,
  evaluatePromotionPolicy,
  isControlTowerReleaseFrozen,
} from "../lib/control-tower-state-machine.js";
import {
  sanitizeControlTowerEvidenceSnapshot,
  validateControlTowerEvidenceInput,
} from "../lib/control-tower-evidence.js";
import {
  buildControlTowerReleaseSnapshot,
  evaluateControlTowerProductionDrift,
  hashControlTowerSnapshot,
} from "../lib/control-tower-snapshot.js";
import {
  isControlTowerUuid,
  validateControlTowerReleaseInput,
  validateControlTowerReleasePatchInput,
  validateControlTowerWorkstreamInput,
  validateControlTowerItemInput,
  validateControlTowerGateInput,
} from "../lib/control-tower-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const RELEASE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSTREAM_ID = "22222222-2222-4222-8222-222222222222";

const layout = read("app/admin/control-tower/layout.js");
const statusApi = read("app/api/admin/control-tower/status/route.js");
const releasesApi = read("app/api/admin/control-tower/releases/route.js");
const workstreamsApi = read("app/api/admin/control-tower/workstreams/route.js");
const itemsApi = read("app/api/admin/control-tower/items/route.js");
const gatesApi = read("app/api/admin/control-tower/gates/route.js");
const readinessApi = read("app/api/admin/control-tower/readiness/route.js");
const promotionApi = read("app/api/admin/control-tower/promotion/route.js");
const evidenceApi = read("app/api/admin/control-tower/evidence/route.js");
const auditApi = read("app/api/admin/control-tower/audit/route.js");
const integrityApi = read("app/api/admin/control-tower/integrity/route.js");
const snapshotApi = read("app/api/admin/control-tower/snapshot/route.js");
const http = read("lib/control-tower-http.js");
const auth = read("lib/control-tower-auth.js");
const apiBoundary = read("lib/control-tower-api.js");
const auditHelper = read("lib/control-tower-audit.js");
const privileged = read("lib/control-tower-privileged.js");
const baseMigration = read("supabase/migrations/20260906190000_admin_control_tower.sql");
const hardeningMigration = read("supabase/migrations/20260906193000_admin_control_tower_hardening.sql");
const auditMigration = read("supabase/migrations/20260906202000_admin_control_tower_audit_chain.sql");
const privilegedMigration = read("supabase/migrations/20260906203500_admin_control_tower_privileged_mutations.sql");
const productionMigration = read("supabase/migrations/20260906203500_admin_control_tower_atomic_production_promotion.sql");

// Central authorization and API boundary: implementation details may move, contracts may not.
assert.match(layout, /getControlTowerAuthContext/);
assert.doesNotMatch(layout, /createClient/);
assert.match(auth, /controlTowerRoleFromUser/);
assert.match(apiBoundary, /getControlTowerAuthContext/);
assert.match(apiBoundary, /controlTowerMutationGuard/);
for (const source of [statusApi, releasesApi, workstreamsApi, itemsApi, gatesApi, readinessApi, promotionApi, evidenceApi, integrityApi, snapshotApi]) {
  assert.match(source, /requireControlTowerApi/);
}
for (const source of [releasesApi, workstreamsApi, itemsApi, gatesApi, readinessApi, promotionApi, evidenceApi]) {
  assert.match(source, /mutation:\s*true/);
}
assert.match(http, /application\/json/);
assert.match(http, /BODY_TOO_LARGE/);
assert.match(http, /ORIGIN_MISMATCH/);
assert.match(http, /Cross-Origin-Resource-Policy/);
assert.match(http, /Permissions-Policy/);
assert.match(http, /Vary:\s*"Cookie"/);

// Sealed audit path must be used by mutating APIs; direct audit inserts are forbidden.
for (const source of [releasesApi, workstreamsApi, itemsApi, gatesApi, readinessApi, evidenceApi]) {
  assert.match(source, /appendControlTowerAudit/);
  assert.doesNotMatch(source, /from\(["']control_tower_audit_log["']\)\.insert/);
}
assert.match(auditHelper, /append_control_tower_audit/);
assert.match(auditApi, /prev_hash,event_hash/);
assert.match(auditApi, /chainHead/);
assert.match(integrityApi, /verify_control_tower_audit_chain/);
assert.match(integrityApi, /evaluateControlTowerProductionDrift/);

// Critical evidence writes are server-authorized and privileged after user authorization.
assert.match(evidenceApi, /getControlTowerPrivilegedClient/);
assert.match(evidenceApi, /privileged_write/);
assert.match(privileged, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(privilegedMigration, /item_type <> 'evidence'/);
assert.match(privilegedMigration, /revoke update on public\.control_tower_releases from authenticated/i);
assert.match(privilegedMigration, /control_tower_item_release_integrity_guard/);
assert.match(privilegedMigration, /control_tower_release_initial_stage_guard/);

// Production promotion is exact-SHA/technical-ceiling/attestation governed and atomic in DB.
assert.match(promotionApi, /computeControlTowerTechnicalCeiling/);
assert.match(promotionApi, /promote_control_tower_production_with_attestation/);
assert.match(promotionApi, /TECHNICAL_CEILING_NOT_MET/);
assert.match(productionMigration, /for update/);
assert.match(productionMigration, /append_control_tower_release_attestation/);
assert.match(productionMigration, /append_control_tower_audit/);
assert.match(productionMigration, /Technical Ceiling 100/i);

// Database isolation and immutability contracts.
assert.match(baseMigration, /enable row level security/);
assert.match(baseMigration, /control_tower_single_active_release_idx/);
assert.match(hardeningMigration, /control_tower_evidence_fingerprint_idx/);
assert.match(auditMigration, /extensions\.digest/);
assert.match(auditMigration, /verify_control_tower_audit_chain/);
assert.match(auditMigration, /revoke insert on public\.control_tower_audit_log from authenticated/i);

// Dedicated Control Tower role can coexist with legacy admin role.
assert.equal(controlTowerRoleFromAppMetadata({ control_tower_role: "owner", role: "user" }), "owner");
assert.equal(controlTowerRoleFromAppMetadata({ role: "admin" }), "admin");
assert.equal(canPromoteControlTowerProduction("owner"), true);
assert.equal(canPromoteControlTowerProduction("admin"), false);
assert.equal(canWaiveControlTowerGate("super_admin"), true);
assert.equal(canWaiveControlTowerGate("admin"), false);

// GitHub CI aggregation: failed or pending check-runs cannot be hidden by legacy status.
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "completed", conclusion: "success" }] }), "success");
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "completed", conclusion: "failure" }] }), "failure");
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "in_progress", conclusion: null }] }), "pending");

const verified = evaluateReleaseTruth({ mainSha: "abc123", runtimeSha: "abc123", environment: "production", ciState: "success", supabaseConfigured: true });
assert.equal(verified.productionVerified, true);
assert.equal(verified.gates.find((gate) => gate.id === "exact-sha")?.state, "pass");
const preview = evaluateReleaseTruth({ mainSha: "abc123", runtimeSha: "abc123", environment: "preview", ciState: "success", supabaseConfigured: true });
assert.equal(preview.exactSha, true);
assert.equal(preview.productionVerified, false);
const mismatch = evaluateReleaseTruth({ mainSha: "abc123", runtimeSha: "def456", environment: "production", ciState: "success", supabaseConfigured: true });
assert.equal(mismatch.productionVerified, false);
assert.equal(mismatch.state, "blocked");

// Input validation: forged high-stage creation and malformed IDs are rejected.
assert.equal(isControlTowerUuid(RELEASE_ID), true);
assert.equal(isControlTowerUuid("release-1"), false);
const validRelease = validateControlTowerReleaseInput({ productVersion: "LANERIQ AI 2.0", releaseVersion: "v2.4.0", releaseStatus: "active", stage: "planned", targetPlatforms: ["Web", "iOS", "web"] });
assert.equal(validRelease.ok, true);
assert.deepEqual(validRelease.value.target_platforms, ["web", "ios"]);
assert.equal(validateControlTowerReleaseInput({ productVersion: "LANERIQ", releaseVersion: "v1", stage: "production" }).ok, false);
assert.equal(validateControlTowerReleasePatchInput({ id: RELEASE_ID, stage: "production" }).ok, false);

const validWorkstream = validateControlTowerWorkstreamInput({ releaseId: RELEASE_ID, workstreamKey: "AI Video", name: "AI Video", stage: "ready" });
assert.equal(validWorkstream.ok, true);
assert.equal(validWorkstream.value.workstream_key, "ai-video");
assert.equal(validateControlTowerWorkstreamInput({ releaseId: RELEASE_ID, workstreamKey: "x", name: "X", stage: "production" }).ok, false);

const validRisk = validateControlTowerItemInput({ releaseId: RELEASE_ID, workstreamId: WORKSTREAM_ID, itemType: "risk", title: "Provider capacity risk", priority: "p1", stage: "in_progress", metadata: { owner: "cloud" } });
assert.equal(validRisk.ok, true);
assert.equal(validRisk.value.priority, "p1");
assert.equal(validateControlTowerItemInput({ releaseId: RELEASE_ID, itemType: "evidence", title: "forged" }).ok, false);
assert.equal(validateControlTowerItemInput({ releaseId: RELEASE_ID, itemType: "risk", title: "x", stage: "verification" }).ok, false);

const validGate = validateControlTowerGateInput({ releaseId: RELEASE_ID, gateKey: "Security", label: "Security verification", state: "pass", required: true, evidence: { source: "runtime" } });
assert.equal(validGate.ok, true);
assert.equal(validGate.value.gate_key, "security");
assert.equal(validateControlTowerGateInput({ releaseId: RELEASE_ID, gateKey: "performance", label: "Performance", state: "waived" }).ok, false);

// Dependency graph and promotion policy.
const dependencyHealthy = analyzeWorkstreamDependencies([
  { workstream_key: "ui", stage: "code_complete", dependencies: [] },
  { workstream_key: "builder", stage: "verification", dependencies: ["ui"] },
]);
assert.equal(dependencyHealthy.healthy, true);
const dependencyBroken = analyzeWorkstreamDependencies([
  { workstream_key: "a", stage: "in_progress", dependencies: ["b", "missing"] },
  { workstream_key: "b", stage: "planned", dependencies: ["a"] },
]);
assert.equal(dependencyBroken.healthy, false);
assert.equal(dependencyBroken.missing.length, 1);
assert.ok(dependencyBroken.cycles.length >= 1);

const allPassingGates = CONTROL_TOWER_STANDARD_GATES.map((gate, index) => ({ id: `g${index}`, ...gate, state: "pass" }));
const perfectScorecard = computeReleaseScorecard({
  release: { id: RELEASE_ID, stage: "verification" },
  workstreams: [
    { workstream_key: "ui", stage: "closed", dependencies: [] },
    { workstream_key: "builder", stage: "closed", dependencies: ["ui"] },
  ],
  items: [],
  gates: allPassingGates,
  liveStatus: { releaseTruth: { exactSha: true, productionVerified: true, gates: [
    { id: "github-main", state: "pass", detail: "abc" },
    { id: "runtime-identity", state: "pass", detail: "abc" },
    { id: "exact-sha", state: "pass", detail: "match" },
    { id: "supabase", state: "pass", detail: "configured" },
  ] } },
});
assert.equal(perfectScorecard.overall, 100);
assert.equal(perfectScorecard.rcEligible, true);
assert.equal(perfectScorecard.productionEligible, true);
assert.equal(canTransitionControlTowerStage("verification", "release_candidate"), true);
assert.equal(canTransitionControlTowerStage("verification", "production"), false);
assert.equal(isControlTowerReleaseFrozen("release_candidate"), true);
assert.equal(evaluatePromotionPolicy({ currentStage: "verification", targetStage: "release_candidate", scorecard: perfectScorecard }).allowed, true);

// Evidence sanitization and identity: changing a title must not create a new underlying proof.
const sanitized = sanitizeControlTowerEvidenceSnapshot({ status: "READY", nested: { access_token: "secret-value", authorization: "Bearer abc", session: "cookie", sha: "abc123" } });
assert.equal(sanitized.nested.access_token, "[redacted]");
assert.equal(sanitized.nested.authorization, "[redacted]");
assert.equal(sanitized.nested.session, "[redacted]");
assert.equal(sanitized.nested.sha, "abc123");
const evidenceA = validateControlTowerEvidenceInput({ releaseId: RELEASE_ID, kind: "vercel_deployment", title: "Preview build", externalRef: "dpl_123", snapshot: { state: "READY", api_key: "secret-a" } });
const evidenceB = validateControlTowerEvidenceInput({ releaseId: RELEASE_ID, kind: "vercel_deployment", title: "Renamed proof", externalRef: "dpl_123", snapshot: { state: "READY", api_key: "secret-b" } });
assert.equal(evidenceA.ok, true);
assert.equal(evidenceA.value.metadata.snapshot.api_key, "[redacted]");
assert.equal(evidenceA.value.metadata.fingerprint, evidenceB.value.metadata.fingerprint);

// Deterministic release snapshot hashes are stable across input ordering.
const snapshotA = buildControlTowerReleaseSnapshot({
  release: { id: RELEASE_ID, release_version: "v1", stage: "verification" },
  workstreams: [
    { id: "b", workstream_key: "b", stage: "planned", dependencies: [] },
    { id: "a", workstream_key: "a", stage: "closed", dependencies: [] },
  ],
  items: [],
  gates: [],
});
const snapshotB = buildControlTowerReleaseSnapshot({
  release: { id: RELEASE_ID, release_version: "v1", stage: "verification" },
  workstreams: [
    { id: "a", workstream_key: "a", stage: "closed", dependencies: [] },
    { id: "b", workstream_key: "b", stage: "planned", dependencies: [] },
  ],
  items: [],
  gates: [],
});
assert.equal(snapshotA.snapshotHash, snapshotB.snapshotHash);
assert.equal(hashControlTowerSnapshot({ b: 2, a: 1 }), hashControlTowerSnapshot({ a: 1, b: 2 }));

const noDrift = evaluateControlTowerProductionDrift({
  github_main_sha: "abc", github_ci_state: "success", runtime_sha: "abc", runtime_environment: "production", runtime_branch: "main", supabase_configured: true, exact_sha: true, production_verified: true,
}, {
  repository: "chaibeechew/LANERIQ-AI",
  github: { mainSha: "abc", ciState: "success" },
  runtime: { commitSha: "abc", environment: "production", branch: "main", supabaseConfigured: true },
  releaseTruth: { exactSha: true, productionVerified: true, state: "verified" },
});
assert.equal(noDrift.drifted, false);
const drift = evaluateControlTowerProductionDrift({ runtime_sha: "old", production_verified: true }, {
  github: {}, runtime: { commitSha: "new", environment: "production", supabaseConfigured: true }, releaseTruth: { exactSha: false, productionVerified: false },
});
assert.equal(drift.drifted, true);
assert.ok(drift.mismatches.some((item) => item.field === "runtime_sha"));

console.log("Control Tower contract tests passed.");
