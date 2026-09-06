import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseTruth } from "../lib/control-tower-runtime.js";
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
  validateControlTowerReleaseInput,
  validateControlTowerWorkstreamInput,
  validateControlTowerItemInput,
  validateControlTowerGateInput,
} from "../lib/control-tower-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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
const panel = read("app/admin/control-tower/LiveReleasePanel.js");
const managementBoard = read("app/admin/control-tower/ManagementBoard.js");
const governanceBoard = read("app/admin/control-tower/GovernanceBoard.js");
const readinessBoard = read("app/admin/control-tower/ReadinessBoard.js");
const adminAccess = read("lib/admin-access.js");
const migration = read("supabase/migrations/20260906190000_admin_control_tower.sql");
const hardeningMigration = read("supabase/migrations/20260906193000_admin_control_tower_hardening.sql");

assert.match(layout, /canAccessControlTower/);
assert.match(layout, /supabase\.auth\.getUser\(\)/);
for (const source of [statusApi, releasesApi, workstreamsApi, itemsApi, gatesApi, readinessApi, promotionApi, evidenceApi, auditApi]) {
  assert.match(source, /canAccessControlTower/);
  assert.match(source, /Cache-Control/);
  assert.match(source, /no-store/);
}
assert.match(panel, /\/api\/admin\/control-tower\/status/);
assert.match(panel, /credentials:\s*"same-origin"/);
assert.match(managementBoard, /\/api\/admin\/control-tower\/releases/);
assert.match(managementBoard, /\/api\/admin\/control-tower\/workstreams/);
assert.match(governanceBoard, /\/api\/admin\/control-tower\/items/);
assert.match(governanceBoard, /\/api\/admin\/control-tower\/gates/);
assert.match(governanceBoard, /ctGovernance/);
assert.match(readinessBoard, /\/api\/admin\/control-tower\/readiness/);
assert.match(readinessBoard, /ctReadiness/);
assert.match(workstreamsApi, /isControlTowerReleaseFrozen/);
assert.match(itemsApi, /RELEASE_FROZEN/);
assert.match(promotionApi, /evaluatePromotionPolicy/);
assert.match(promotionApi, /expectedUpdatedAt/);
assert.match(evidenceApi, /DUPLICATE_EVIDENCE/);
assert.match(adminAccess, /"owner"/);
assert.match(adminAccess, /"super_admin"/);
assert.match(adminAccess, /"admin"/);

assert.match(migration, /enable row level security/);
assert.match(migration, /control_tower_items/);
assert.match(migration, /control_tower_release_gates/);
assert.match(migration, /control_tower_audit_log/);
assert.match(migration, /is_control_tower_admin/);
assert.match(migration, /control_tower_single_active_release_idx/);
assert.match(migration, /control_tower_guard_release_stage_transition/);
assert.match(migration, /control_tower_audit_immutable/);
assert.match(hardeningMigration, /control_tower_evidence_fingerprint_idx/);
assert.match(hardeningMigration, /tg_op = 'DELETE'/);

const verified = evaluateReleaseTruth({
  mainSha: "abc123",
  runtimeSha: "abc123",
  environment: "production",
  ciState: "success",
  supabaseConfigured: true,
});
assert.equal(verified.exactSha, true);
assert.equal(verified.productionVerified, true);
assert.equal(verified.state, "verified");
assert.equal(verified.gates.find((gate) => gate.id === "exact-sha")?.state, "pass");

const mismatch = evaluateReleaseTruth({
  mainSha: "abc123",
  runtimeSha: "def456",
  environment: "production",
  ciState: "success",
  supabaseConfigured: true,
});
assert.equal(mismatch.productionVerified, false);
assert.equal(mismatch.state, "blocked");
assert.equal(mismatch.gates.find((gate) => gate.id === "exact-sha")?.state, "fail");

const preview = evaluateReleaseTruth({
  mainSha: "abc123",
  runtimeSha: "abc123",
  environment: "preview",
  ciState: "success",
  supabaseConfigured: true,
});
assert.equal(preview.exactSha, true);
assert.equal(preview.productionVerified, false);
assert.equal(preview.state, "pending");
assert.equal(preview.gates.find((gate) => gate.id === "environment")?.state, "pending");

const validRelease = validateControlTowerReleaseInput({
  productVersion: "LANERIQ AI 2.0",
  releaseVersion: "v2.4.0",
  releaseStatus: "active",
  stage: "verification",
  targetPlatforms: ["Web", "iOS", "web"],
});
assert.equal(validRelease.ok, true);
assert.deepEqual(validRelease.value.target_platforms, ["web", "ios"]);
assert.equal(validateControlTowerReleaseInput({ releaseVersion: "v1" }).ok, false);
assert.equal(validateControlTowerReleaseInput({ productVersion: "LANERIQ", releaseVersion: "v1", stage: "invalid" }).ok, false);

const validWorkstream = validateControlTowerWorkstreamInput({
  releaseId: "release-1",
  workstreamKey: "AI Video",
  name: "AI Video",
  stage: "in_progress",
});
assert.equal(validWorkstream.ok, true);
assert.equal(validWorkstream.value.workstream_key, "ai-video");
assert.equal(validateControlTowerWorkstreamInput({ releaseId: "release-1", name: "UI" }).ok, false);

const validRisk = validateControlTowerItemInput({
  releaseId: "release-1",
  itemType: "risk",
  title: "Provider capacity risk",
  priority: "p1",
  stage: "verification",
  metadata: { owner: "cloud" },
});
assert.equal(validRisk.ok, true);
assert.equal(validRisk.value.item_type, "risk");
assert.equal(validRisk.value.priority, "p1");
assert.equal(validateControlTowerItemInput({ releaseId: "release-1", itemType: "unknown", title: "x" }).ok, false);
assert.equal(validateControlTowerItemInput({ releaseId: "release-1", itemType: "risk", title: "x", priority: "p9" }).ok, false);

const validGate = validateControlTowerGateInput({
  releaseId: "release-1",
  gateKey: "Production Exact SHA",
  label: "Production exact-SHA verified",
  state: "pass",
  required: true,
  evidence: { source: "runtime" },
});
assert.equal(validGate.ok, true);
assert.equal(validGate.value.gate_key, "production-exact-sha");
assert.equal(validGate.value.required, true);
assert.equal(validateControlTowerGateInput({ releaseId: "release-1", gateKey: "ci", label: "CI", state: "broken" }).ok, false);

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
assert.ok(dependencyBroken.blocked.length >= 1);

const allPassingGates = CONTROL_TOWER_STANDARD_GATES.map((gate, index) => ({ id: `g${index}`, ...gate, state: "pass" }));
const perfectScorecard = computeReleaseScorecard({
  release: { id: "r1", stage: "verification" },
  workstreams: [
    { workstream_key: "ui", stage: "closed", dependencies: [] },
    { workstream_key: "builder", stage: "closed", dependencies: ["ui"] },
  ],
  items: [],
  gates: allPassingGates,
  liveStatus: { releaseTruth: { exactSha: true, productionVerified: true } },
});
assert.equal(perfectScorecard.overall, 100);
assert.equal(perfectScorecard.rcEligible, true);
assert.equal(perfectScorecard.productionEligible, true);

const blockedScorecard = computeReleaseScorecard({
  release: { id: "r2", stage: "verification" },
  workstreams: [{ workstream_key: "builder", stage: "in_progress", dependencies: ["missing"] }],
  items: [{ id: "risk-1", title: "Critical", priority: "p0", stage: "verification" }],
  gates: [{ gate_key: "security", required: true, state: "fail" }],
  liveStatus: { releaseTruth: { exactSha: false, productionVerified: false } },
});
assert.equal(blockedScorecard.rcEligible, false);
assert.ok(blockedScorecard.hardBlockers.length >= 3);

assert.equal(canTransitionControlTowerStage("verification", "release_candidate"), true);
assert.equal(canTransitionControlTowerStage("verification", "production"), false);
assert.equal(canTransitionControlTowerStage("production", "release_candidate"), false);
assert.equal(isControlTowerReleaseFrozen("release_candidate"), true);
assert.equal(isControlTowerReleaseFrozen("verification"), false);
assert.equal(evaluatePromotionPolicy({ currentStage: "verification", targetStage: "release_candidate", scorecard: perfectScorecard }).allowed, true);
assert.equal(evaluatePromotionPolicy({ currentStage: "release_candidate", targetStage: "production", scorecard: blockedScorecard }).allowed, false);

const sanitized = sanitizeControlTowerEvidenceSnapshot({
  status: "READY",
  nested: { access_token: "secret-value", authorization: "Bearer abc", sha: "abc123" },
});
assert.equal(sanitized.nested.access_token, "[redacted]");
assert.equal(sanitized.nested.authorization, "[redacted]");
assert.equal(sanitized.nested.sha, "abc123");

const evidenceA = validateControlTowerEvidenceInput({
  releaseId: "r1",
  kind: "vercel_deployment",
  title: "Preview build",
  externalRef: "dpl_123",
  snapshot: { state: "READY", api_key: "must-not-store" },
});
const evidenceB = validateControlTowerEvidenceInput({
  releaseId: "r1",
  kind: "vercel_deployment",
  title: "Preview build",
  externalRef: "dpl_123",
  snapshot: { state: "READY", api_key: "different-secret" },
});
assert.equal(evidenceA.ok, true);
assert.equal(evidenceA.value.metadata.snapshot.api_key, "[redacted]");
assert.equal(evidenceA.value.metadata.fingerprint, evidenceB.value.metadata.fingerprint);
assert.equal(validateControlTowerEvidenceInput({ releaseId: "r1", kind: "unknown", title: "x" }).ok, false);

console.log("Control Tower contract tests passed.");
