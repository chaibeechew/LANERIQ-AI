import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canPromoteControlTowerProduction,
  canWaiveControlTowerGate,
  controlTowerRoleFromAppMetadata,
} from "../lib/admin-access.js";
import { deriveGitHubCiState, evaluateReleaseTruth } from "../lib/control-tower-runtime.js";
import { analyzeWorkstreamDependencies } from "../lib/control-tower-governance.js";
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
  validateControlTowerGateInput,
  validateControlTowerItemInput,
  validateControlTowerReleaseInput,
  validateControlTowerReleasePatchInput,
  validateControlTowerWorkstreamInput,
} from "../lib/control-tower-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const RELEASE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSTREAM_ID = "22222222-2222-4222-8222-222222222222";

const routes = {
  status: read("app/api/admin/control-tower/status/route.js"),
  releases: read("app/api/admin/control-tower/releases/route.js"),
  workstreams: read("app/api/admin/control-tower/workstreams/route.js"),
  items: read("app/api/admin/control-tower/items/route.js"),
  gates: read("app/api/admin/control-tower/gates/route.js"),
  readiness: read("app/api/admin/control-tower/readiness/route.js"),
  promotion: read("app/api/admin/control-tower/promotion/route.js"),
  evidence: read("app/api/admin/control-tower/evidence/route.js"),
  audit: read("app/api/admin/control-tower/audit/route.js"),
  integrity: read("app/api/admin/control-tower/integrity/route.js"),
  snapshot: read("app/api/admin/control-tower/snapshot/route.js"),
  resilience: read("app/api/admin/control-tower/resilience/route.js"),
  ceiling: read("app/api/admin/control-tower/technical-ceiling/route.js"),
};
const layout = read("app/admin/control-tower/layout.js");
const auth = read("lib/control-tower-auth.js");
const apiBoundary = read("lib/control-tower-api.js");
const http = read("lib/control-tower-http.js");
const auditHelper = read("lib/control-tower-audit.js");
const privileged = read("lib/control-tower-privileged.js");
const baseMigration = read("supabase/migrations/20260906190000_admin_control_tower.sql");
const hardeningMigration = read("supabase/migrations/20260906193000_admin_control_tower_hardening.sql");
const auditMigration = read("supabase/migrations/20260906202000_admin_control_tower_audit_chain.sql");
const privilegedMigration = read("supabase/migrations/20260906203500_admin_control_tower_privileged_mutations.sql");
const productionMigration = read("supabase/migrations/20260906203500_admin_control_tower_atomic_production_promotion.sql");
const transitionMigration = read("supabase/migrations/20260906204100_admin_control_tower_atomic_stage_transition.sql");
const evidenceMigration = read("supabase/migrations/20260906204200_admin_control_tower_atomic_evidence.sql");
const freezeMigration = read("supabase/migrations/20260906204300_admin_control_tower_freeze_integrity.sql");

// One centralized server authorization boundary for every Control Tower route.
assert.match(layout, /getControlTowerAuthContext/);
assert.doesNotMatch(layout, /createClient/);
assert.match(auth, /controlTowerRoleFromUser/);
assert.match(apiBoundary, /getControlTowerAuthContext/);
assert.match(apiBoundary, /controlTowerMutationGuard/);
for (const source of Object.values(routes)) assert.match(source, /requireControlTowerApi/);
for (const key of ["releases", "workstreams", "items", "gates", "readiness", "promotion", "evidence"]) {
  assert.match(routes[key], /mutation:\s*true/);
}

// HTTP mutation envelope: same-origin JSON, bounded request size, hardened private responses.
assert.match(http, /ORIGIN_REQUIRED/);
assert.match(http, /ORIGIN_MISMATCH/);
assert.match(http, /FETCH_SITE_BLOCKED/);
assert.match(http, /JSON_REQUIRED/);
assert.match(http, /BODY_TOO_LARGE/);
assert.match(http, /Cross-Origin-Resource-Policy/);
assert.match(http, /Permissions-Policy/);
assert.match(http, /Vary:\s*"Cookie"/);

// Mutations are auditable; evidence and stage transitions are transactionally audited by RPC.
for (const key of ["releases", "workstreams", "items", "gates", "readiness"]) {
  assert.match(routes[key], /appendControlTowerAudit/);
  assert.doesNotMatch(routes[key], /from\(["']control_tower_audit_log["']\)\.insert/);
}
assert.match(auditHelper, /append_control_tower_audit/);
assert.match(routes.evidence, /register_control_tower_evidence_server/);
assert.doesNotMatch(routes.evidence, /appendControlTowerAudit/);
assert.match(routes.promotion, /transition_control_tower_release_stage_server/);
assert.match(routes.promotion, /promote_control_tower_production_with_attestation/);
assert.doesNotMatch(routes.promotion, /\.update\(\{\s*stage:/);

// Tamper-evident audit-chain and integrity/drift verification.
assert.match(routes.audit, /prev_hash,event_hash/);
assert.match(routes.audit, /chainHead/);
assert.match(routes.integrity, /verify_control_tower_audit_chain/);
assert.match(routes.integrity, /evaluateControlTowerProductionDrift/);
assert.match(auditMigration, /extensions\.digest/);
assert.match(auditMigration, /verify_control_tower_audit_chain/);
assert.match(auditMigration, /pg_advisory_xact_lock/);
assert.match(auditMigration, /revoke insert on public\.control_tower_audit_log from authenticated/i);

// DB defense-in-depth, privileged writes, atomic critical operations and frozen-release semantics.
assert.match(baseMigration, /enable row level security/);
assert.match(baseMigration, /control_tower_single_active_release_idx/);
assert.match(hardeningMigration, /control_tower_evidence_fingerprint_idx/);
assert.match(privileged, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(privilegedMigration, /item_type <> 'evidence'/);
assert.match(privilegedMigration, /revoke update on public\.control_tower_releases from authenticated/i);
assert.match(privilegedMigration, /control_tower_item_release_integrity_guard/);
assert.match(transitionMigration, /service_role/);
assert.match(transitionMigration, /release_stage_promoted/);
assert.match(transitionMigration, /insert into public\.control_tower_audit_log/i);
assert.match(evidenceMigration, /register_control_tower_evidence_server/);
assert.match(evidenceMigration, /atomic_write/);
assert.match(evidenceMigration, /insert into public\.control_tower_audit_log/i);
assert.match(freezeMigration, /existing items are immutable/i);
assert.match(freezeMigration, /only new evidence\/decision may be appended/i);

// Production alone requires exact runtime truth + Technical Ceiling 100 + immutable attestation.
assert.match(routes.promotion, /computeControlTowerTechnicalCeiling/);
assert.match(routes.promotion, /TECHNICAL_CEILING_NOT_MET/);
assert.match(productionMigration, /append_control_tower_release_attestation/);
assert.match(productionMigration, /append_control_tower_audit/);
assert.match(productionMigration, /Technical Ceiling 100/i);
assert.match(routes.snapshot, /buildControlTowerReleaseSnapshot/);

// Dedicated Control Tower role does not require changing legacy app-wide admin semantics.
assert.equal(controlTowerRoleFromAppMetadata({ control_tower_role: "owner", role: "user" }), "owner");
assert.equal(controlTowerRoleFromAppMetadata({ role: "admin" }), "admin");
assert.equal(canPromoteControlTowerProduction("owner"), true);
assert.equal(canPromoteControlTowerProduction("admin"), false);
assert.equal(canWaiveControlTowerGate("super_admin"), true);
assert.equal(canWaiveControlTowerGate("admin"), false);

// GitHub check-runs participate in release truth; Preview can never masquerade as Production.
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "completed", conclusion: "success" }] }), "success");
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "completed", conclusion: "failure" }] }), "failure");
assert.equal(deriveGitHubCiState({ legacyState: "success", checkRuns: [{ status: "in_progress", conclusion: null }] }), "pending");
const verified = evaluateReleaseTruth({ mainSha: "abc", runtimeSha: "abc", environment: "production", ciState: "success", supabaseConfigured: true });
assert.equal(verified.productionVerified, true);
const preview = evaluateReleaseTruth({ mainSha: "abc", runtimeSha: "abc", environment: "preview", ciState: "success", supabaseConfigured: true });
assert.equal(preview.exactSha, true);
assert.equal(preview.productionVerified, false);
const mismatch = evaluateReleaseTruth({ mainSha: "abc", runtimeSha: "def", environment: "production", ciState: "success", supabaseConfigured: true });
assert.equal(mismatch.state, "blocked");

// Creation cannot forge completed/Production state; stage changes use the governed endpoint.
assert.equal(isControlTowerUuid(RELEASE_ID), true);
assert.equal(isControlTowerUuid("release-1"), false);
assert.equal(validateControlTowerReleaseInput({ productVersion: "LANERIQ", releaseVersion: "v1", stage: "planned" }).ok, true);
assert.equal(validateControlTowerReleaseInput({ productVersion: "LANERIQ", releaseVersion: "v1", stage: "production" }).ok, false);
assert.equal(validateControlTowerReleasePatchInput({ id: RELEASE_ID, stage: "production" }).ok, false);
assert.equal(validateControlTowerWorkstreamInput({ releaseId: RELEASE_ID, workstreamKey: "security", name: "Security", stage: "ready" }).ok, true);
assert.equal(validateControlTowerWorkstreamInput({ releaseId: RELEASE_ID, workstreamKey: "security", name: "Security", stage: "production" }).ok, false);
assert.equal(validateControlTowerItemInput({ releaseId: RELEASE_ID, workstreamId: WORKSTREAM_ID, itemType: "risk", title: "Risk", stage: "in_progress" }).ok, true);
assert.equal(validateControlTowerItemInput({ releaseId: RELEASE_ID, itemType: "evidence", title: "Forged evidence" }).ok, false);
assert.equal(validateControlTowerItemInput({ releaseId: RELEASE_ID, itemType: "risk", title: "Forged completed risk", stage: "verification" }).ok, false);
assert.equal(validateControlTowerGateInput({ releaseId: RELEASE_ID, gateKey: "security", label: "Security", state: "waived" }).ok, false);

// Dependency cycles/missing dependencies and lifecycle invariants remain blocking.
const healthy = analyzeWorkstreamDependencies([
  { workstream_key: "ui", stage: "code_complete", dependencies: [] },
  { workstream_key: "builder", stage: "verification", dependencies: ["ui"] },
]);
assert.equal(healthy.healthy, true);
const broken = analyzeWorkstreamDependencies([
  { workstream_key: "a", stage: "in_progress", dependencies: ["b", "missing"] },
  { workstream_key: "b", stage: "planned", dependencies: ["a"] },
]);
assert.equal(broken.healthy, false);
assert.equal(broken.missing.length, 1);
assert.ok(broken.cycles.length >= 1);
assert.equal(canTransitionControlTowerStage("verification", "release_candidate"), true);
assert.equal(canTransitionControlTowerStage("verification", "production"), false);
assert.equal(isControlTowerReleaseFrozen("release_candidate"), true);
assert.equal(evaluatePromotionPolicy({ currentStage: "verification", targetStage: "release_candidate", scorecard: { rcEligible: true } }).allowed, true);
assert.equal(evaluatePromotionPolicy({ currentStage: "release_candidate", targetStage: "production", scorecard: { productionEligible: false } }).allowed, false);

// Evidence is bounded/redacted and duplicate identity cannot be bypassed by renaming it.
const sanitized = sanitizeControlTowerEvidenceSnapshot({ nested: { access_token: "secret", authorization: "Bearer x", session: "cookie", sha: "abc" } });
assert.equal(sanitized.nested.access_token, "[redacted]");
assert.equal(sanitized.nested.authorization, "[redacted]");
assert.equal(sanitized.nested.session, "[redacted]");
assert.equal(sanitized.nested.sha, "abc");
const evidenceA = validateControlTowerEvidenceInput({ releaseId: RELEASE_ID, kind: "vercel_deployment", title: "Build A", externalRef: "dpl_1", snapshot: { state: "READY", api_key: "secret-a" } });
const evidenceB = validateControlTowerEvidenceInput({ releaseId: RELEASE_ID, kind: "vercel_deployment", title: "Renamed", externalRef: "dpl_1", snapshot: { state: "READY", api_key: "secret-b" } });
assert.equal(evidenceA.ok, true);
assert.equal(evidenceA.value.metadata.snapshot.api_key, "[redacted]");
assert.equal(evidenceA.value.metadata.fingerprint, evidenceB.value.metadata.fingerprint);

// Snapshot hashes are canonical/order-invariant; stored Production truth is continuously drift-checkable.
assert.equal(hashControlTowerSnapshot({ b: 2, a: 1 }), hashControlTowerSnapshot({ a: 1, b: 2 }));
const snapA = buildControlTowerReleaseSnapshot({
  release: { id: RELEASE_ID, release_version: "v1", stage: "verification" },
  workstreams: [{ id: "2", workstream_key: "b", dependencies: [] }, { id: "1", workstream_key: "a", dependencies: [] }],
});
const snapB = buildControlTowerReleaseSnapshot({
  release: { id: RELEASE_ID, release_version: "v1", stage: "verification" },
  workstreams: [{ id: "1", workstream_key: "a", dependencies: [] }, { id: "2", workstream_key: "b", dependencies: [] }],
});
assert.equal(snapA.snapshotHash, snapB.snapshotHash);
const noDrift = evaluateControlTowerProductionDrift(
  { github_main_sha: "abc", github_ci_state: "success", runtime_sha: "abc", runtime_environment: "production", runtime_branch: "main", supabase_configured: true, exact_sha: true, production_verified: true },
  { github: { mainSha: "abc", ciState: "success" }, runtime: { commitSha: "abc", environment: "production", branch: "main", supabaseConfigured: true }, releaseTruth: { exactSha: true, productionVerified: true } },
);
assert.equal(noDrift.drifted, false);
const drift = evaluateControlTowerProductionDrift(
  { runtime_sha: "old", production_verified: true },
  { github: {}, runtime: { commitSha: "new", environment: "production", supabaseConfigured: true }, releaseTruth: { exactSha: false, productionVerified: false } },
);
assert.equal(drift.drifted, true);
assert.ok(drift.mismatches.some((item) => item.field === "runtime_sha"));

console.log("Control Tower contract tests passed.");
