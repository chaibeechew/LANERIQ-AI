import assert from "node:assert/strict";
import fs from "node:fs";

const pathScopedWorkflows = [
  ".github/workflows/liui-runtime-capabilities-gate.yml",
  ".github/workflows/liui-living-runtime-v2-gate.yml",
  ".github/workflows/liui-surface-convergence-gate.yml",
  ".github/workflows/liui-real-product-surface-gate.yml",
  ".github/workflows/liui-simplification-performance.yml",
  ".github/workflows/liui-five-layer-100-gate.yml",
  ".github/workflows/auth-mobile-entry.yml",
  ".github/workflows/publish-independent.yml",
  ".github/workflows/communications-independent.yml",
  ".github/workflows/memory-independent.yml",
  ".github/workflows/artifact-materialization-promotion.yml",
  ".github/workflows/service-fabric.yml",
  ".github/workflows/capacity-load-evidence.yml",
  ".github/workflows/no-credits-launch-mode.yml",
  ".github/workflows/benchmark-quality-gate.yml",
  ".github/workflows/sovereign-modular-intelligence.yml",
  ".github/workflows/sovereign-core-services.yml",
  ".github/workflows/workload-protection-exit-drill.yml",
  ".github/workflows/outcome-intelligence-release-gate.yml",
  ".github/workflows/portability-agreement.yml",
  ".github/workflows/batch34b-template-observability.yml",
];

for (const path of pathScopedWorkflows) {
  const source = fs.readFileSync(path, "utf8");
  assert.match(source, /pull_request:\s*\n\s+branches:\s*\[main\]\s*\n\s+paths:/, `${path} must path-scope pull_request execution`);
  assert.match(source, /push:\s*\n\s+branches:\s*\[main\]/, `${path} must retain full main push verification`);
  assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${path} must self-trigger when its workflow definition changes`);
}

const closurePolicy = JSON.parse(fs.readFileSync("config/production-release-closure-policy.json", "utf8"));
const alwaysRequired = new Set((closurePolicy.alwaysRequiredWorkflows || []).map((item) => item.workflowFile));
for (const path of pathScopedWorkflows) {
  const workflowFile = path.split("/").pop();
  assert.ok(!alwaysRequired.has(workflowFile), `${workflowFile} is release-policy always-required and must not be converted into an ordinary changed-domain PR gate`);
}

const productSurface = fs.readFileSync(".github/workflows/18-page-product-surface-gate.yml", "utf8");
assert.ok(alwaysRequired.has("18-page-product-surface-gate.yml"));
assert.match(productSurface, /pull_request:\s*\n\s+branches:\s*\[main\]\s*\n\s*\n?jobs:/, "18-page product surface must remain required on every PR while release policy marks it always-required");
assert.doesNotMatch(productSurface, /pull_request:[\s\S]*?paths:/, "always-required 18-page product surface must not be path-filtered");

const auth = fs.readFileSync(".github/workflows/auth-mobile-entry.yml", "utf8");
assert.match(auth, /- "app\/auth\/\*\*"/);
assert.match(auth, /- "app\/api\/auth\/\*\*"/);
assert.doesNotMatch(auth, /- "supabase\/\*\*"/);

const publish = fs.readFileSync(".github/workflows/publish-independent.yml", "utf8");
assert.match(publish, /- "services\/publish\/\*\*"/);
assert.match(publish, /- "app\/api\/apps\/\*\*\/publish\/\*\*"/);
const communications = fs.readFileSync(".github/workflows/communications-independent.yml", "utf8");
assert.match(communications, /- "lib\/communications\/\*\*"/);
const memory = fs.readFileSync(".github/workflows/memory-independent.yml", "utf8");
assert.match(memory, /- "services\/memory\/\*\*"/);
const artifact = fs.readFileSync(".github/workflows/artifact-materialization-promotion.yml", "utf8");
assert.match(artifact, /- "lib\/infrastructure\/\*\*"/);
const fabric = fs.readFileSync(".github/workflows/service-fabric.yml", "utf8");
assert.match(fabric, /- "services\/fabric\/\*\*"/);
const capacity = fs.readFileSync(".github/workflows/capacity-load-evidence.yml", "utf8");
assert.match(capacity, /- "lib\/infrastructure\/capacity-evidence\.js"/);
const noCredits = fs.readFileSync(".github/workflows/no-credits-launch-mode.yml", "utf8");
assert.match(noCredits, /- "config\/launch-mode\.js"/);
const benchmark = fs.readFileSync(".github/workflows/benchmark-quality-gate.yml", "utf8");
assert.match(benchmark, /- "lib\/ai\/benchmark-factory\.js"/);
const sovereign = fs.readFileSync(".github/workflows/sovereign-modular-intelligence.yml", "utf8");
assert.match(sovereign, /- "lib\/sovereign\/\*\*"/);
const sovereignCore = fs.readFileSync(".github/workflows/sovereign-core-services.yml", "utf8");
assert.match(sovereignCore, /- "services\/identity\/\*\*"/);
const workload = fs.readFileSync(".github/workflows/workload-protection-exit-drill.yml", "utf8");
assert.match(workload, /- "lib\/infrastructure\/\*\*"/);
const outcome = fs.readFileSync(".github/workflows/outcome-intelligence-release-gate.yml", "utf8");
assert.match(outcome, /- "lib\/ai\/\*\*"/);
const portability = fs.readFileSync(".github/workflows/portability-agreement.yml", "utf8");
assert.match(portability, /- "config\/project-portability-policy\.js"/);
const templates = fs.readFileSync(".github/workflows/batch34b-template-observability.yml", "utf8");
assert.match(templates, /- "lib\/templateCatalog\.js"/);

console.log("✓ Twenty-one non-mandatory high-fanout PR gates are changed-domain scoped");
console.log("✓ Release-policy always-required Product Surface gate remains unfiltered on pull requests");
console.log("✓ Full push-to-main verification remains intact");
console.log("✓ Supabase-only PRs avoid twenty-one unrelated gates without weakening the required release policy");
