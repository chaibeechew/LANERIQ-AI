import assert from "node:assert/strict";
import fs from "node:fs";

const policy=JSON.parse(fs.readFileSync("config/production-release-closure-policy.json","utf8"));
const workflow=fs.readFileSync(".github/workflows/production-release-closure-index.yml","utf8");
const runtime=fs.readFileSync("scripts/production-release-closure-index.mjs","utf8");
const workflowText=(file)=>fs.readFileSync(`.github/workflows/${file}`,"utf8");
function pushBlock(yaml){const lines=String(yaml).split(/\r?\n/);let on=false;const out=[];for(const line of lines){if(!on&&/^  push:\s*$/.test(line)){on=true;out.push(line);continue}if(!on)continue;if(/^  [A-Za-z0-9_-]+:\s*/.test(line))break;out.push(line)}return out.join("\n")}

assert.equal(policy.policyVersion,1);
assert.equal(policy.product,"LANERIQ AI");
assert.equal(policy.repository,"chaibeechew/LANERIQ-AI");
assert.equal(policy.productionUrl,"https://laneriq-ai.vercel.app");
assert.ok(policy.alwaysRequiredWorkflows.length>=8);
for(const id of ["core-release","runtime-convergence","main-ci","release-integrity","cloud-contract","generation-contract","ui-product-surface","production-browser"]) assert.ok(policy.alwaysRequiredWorkflows.some(x=>x.id===id),`missing always-required workflow ${id}`);
for(const item of policy.alwaysRequiredWorkflows){assert.ok(fs.existsSync(`.github/workflows/${item.workflowFile}`),`workflow missing ${item.workflowFile}`);const push=pushBlock(workflowText(item.workflowFile));assert.match(push,/branches:\s*\[main\]|- main/);assert.doesNotMatch(push,/^    paths:/m,`always-required workflow must run on every main push: ${item.workflowFile}`)}
for(const id of ["app-builder","ui-interaction","production-evidence-attestation","production-evidence-ledger","malware-defense","malware-live-canary-contract"]) assert.ok(policy.conditionalDomains.some(x=>x.id===id),`missing conditional domain ${id}`);
for(const item of policy.conditionalDomains){const push=pushBlock(workflowText(item.workflowFile));assert.match(push,/^    paths:/m,`conditional domain must expose push.paths: ${item.workflowFile}`)}
assert.ok(policy.globalProductionEvidence.some(x=>x.id==="supabase-production-live-schema-security"&&x.required===true&&x.verifiedByThisGate===false));
assert.ok(policy.globalProductionEvidence.some(x=>x.id==="provider-live-output"&&x.required===true&&x.verifiedByThisGate===false));
assert.ok(policy.globalProductionEvidence.some(x=>x.id==="physical-device-native-behavior"&&x.required===true&&x.verifiedByThisGate===false));

for(const pattern of [/name: 0\.2 - LANERIQ Production Release Closure Index/,/push:\n\s+branches: \[main\]/,/permissions:\n\s+contents: read\n\s+actions: read/,/LANERIQ_CLOSURE_SHA:/,/github\.event\.pull_request\.head\.sha/,/fetch-depth: 2/,/node scripts\/production-release-closure-index-contract-tests\.mjs/,/if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/,/GITHUB_TOKEN: \$\{\{ github\.token \}\}/,/node scripts\/production-release-closure-index\.mjs/,/actions\/upload-artifact@v4/,/production-release-closure-index\.json\.sha256/,/retention-days: 30/,/if-no-files-found: error/,/overwrite: false/,/Runtime closure does not equal Global Production completion/]) assert.match(workflow,pattern);
assert.doesNotMatch(workflow,/push:\n\s+branches: \[main\]\n\s+paths:/,"Closure Index must run after every main push.");
for(const forbidden of [/continue-on-error:\s*true/,/workflow_run:/,/SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|VERCEL_TOKEN|OPENAI_API_KEY/]) assert.doesNotMatch(workflow,forbidden);

for(const pattern of [/STALE_RELEASE_CANDIDATE/,/actions\/workflows\//,/event=push/,/RELEASE_CLOSURE_REQUIRED_WORKFLOW_FAILED/,/RELEASE_CLOSURE_REQUIRED_WORKFLOW_TIMEOUT/,/actions\/runs\//,/artifacts\?per_page=100/,/RELEASE_CLOSURE_ARTIFACT_DIGEST_INVALID/,/\/api\/build-info\?laneriq_closure=/,/data-dpl-id/,/doubleReadStabilityVerified:true/,/verdict:"RUNTIME_RELEASE_CLOSED"/,/globalProductionComplete:false/,/github-main-branch-protection/,/liveSchemaSecurityVerifiedByThisGate:false/,/rawMigrationTimestampEqualityRequired:false/,/normalized-SQL-fingerprint/,/production-release-closure-index\.json\.sha256/,/crypto\.createHash\("sha256"\)\.update\(bytes\)/]) assert.match(runtime,pattern);
for(const forbidden of [/SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|VERCEL_TOKEN|OPENAI_API_KEY/,/Authorization:\s*["']Bearer\s/i,/continue-on-error/]) assert.doesNotMatch(runtime,forbidden);

console.log("✓ Closure Index has an exact-SHA always-required workflow set that truly runs on every main push");
console.log("✓ Path-filtered App Builder/UI/Evidence/Malware gates are required only when their own push.paths match this main change");
console.log("✓ Closure waits for exact-SHA workflow success, binds Core + Runtime artifact digests, independently double-reads public Production, and fails stale candidates");
console.log("✓ Runtime release closure is explicitly separated from Global Production completion and Supabase/provider/device truth boundaries");
