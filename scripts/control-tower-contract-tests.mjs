import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseTruth } from "../lib/control-tower-runtime.js";
import {
  validateControlTowerReleaseInput,
  validateControlTowerWorkstreamInput,
} from "../lib/control-tower-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const layout = read("app/admin/control-tower/layout.js");
const statusApi = read("app/api/admin/control-tower/status/route.js");
const releasesApi = read("app/api/admin/control-tower/releases/route.js");
const workstreamsApi = read("app/api/admin/control-tower/workstreams/route.js");
const panel = read("app/admin/control-tower/LiveReleasePanel.js");
const managementBoard = read("app/admin/control-tower/ManagementBoard.js");
const adminAccess = read("lib/admin-access.js");
const migration = read("supabase/migrations/20260906190000_admin_control_tower.sql");

assert.match(layout, /canAccessControlTower/);
assert.match(layout, /supabase\.auth\.getUser\(\)/);
for (const source of [statusApi, releasesApi, workstreamsApi]) {
  assert.match(source, /canAccessControlTower/);
  assert.match(source, /Cache-Control/);
  assert.match(source, /no-store/);
}
assert.match(panel, /\/api\/admin\/control-tower\/status/);
assert.match(panel, /credentials:\s*"same-origin"/);
assert.match(managementBoard, /\/api\/admin\/control-tower\/releases/);
assert.match(managementBoard, /\/api\/admin\/control-tower\/workstreams/);
assert.match(adminAccess, /"owner"/);
assert.match(adminAccess, /"super_admin"/);
assert.match(adminAccess, /"admin"/);
assert.match(migration, /enable row level security/);
assert.match(migration, /control_tower_audit_log/);
assert.match(migration, /is_control_tower_admin/);

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

console.log("Control Tower contract tests passed.");
