import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseTruth } from "../lib/control-tower-runtime.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const layout = read("app/admin/control-tower/layout.js");
const api = read("app/api/admin/control-tower/status/route.js");
const panel = read("app/admin/control-tower/LiveReleasePanel.js");
const adminAccess = read("lib/admin-access.js");

assert.match(layout, /canAccessControlTower/);
assert.match(layout, /supabase\.auth\.getUser\(\)/);
assert.match(api, /canAccessControlTower/);
assert.match(api, /Cache-Control/);
assert.match(api, /no-store/);
assert.match(panel, /\/api\/admin\/control-tower\/status/);
assert.match(panel, /credentials:\s*"same-origin"/);
assert.match(adminAccess, /"owner"/);
assert.match(adminAccess, /"super_admin"/);
assert.match(adminAccess, /"admin"/);

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

console.log("Control Tower contract tests passed.");
