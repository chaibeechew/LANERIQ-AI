import assert from "node:assert/strict";
import fs from "node:fs";

const workflowPath=".github/workflows/core-release-gate.yml";
const workflow=fs.readFileSync(workflowPath,"utf8");
const manifestSource=fs.readFileSync("scripts/core-release-gate-manifest.mjs","utf8");
for(const pattern of [/name: 0 - LANERIQ Core Release Gate/,/pull_request:\n\s+branches: \[main\]/,/push:\n\s+branches: \[main\]/,/cancel-in-progress: true/,/LANERIQ_CANDIDATE_SHA:/,/github\.event\.pull_request\.head\.sha/,/Checkout exact candidate SHA/,/ref: \$\{\{ env\.LANERIQ_CANDIDATE_SHA \}\}/,/git rev-parse HEAD/,/test "\$actual" = "\$LANERIQ_CANDIDATE_SHA"/,/node services\/cloud\/test\/contract\.mjs/,/node services\/generation\/test\/contract\.mjs/,/npm run test:zero-cost/,/node scripts\/production-evidence-attestation-contract-tests\.mjs/,/node scripts\/production-evidence-ledger-contract-tests\.mjs/,/node scripts\/release-integrity-chain-contract-tests\.mjs/,/npm run build/,/node scripts\/core-release-gate-manifest\.mjs/,/actions\/upload-artifact@v4/,/laneriq-core-release-\$\{\{ env\.LANERIQ_CANDIDATE_SHA \}\}-\$\{\{ github\.run_id \}\}/,/core-release-gate-manifest\.json\.sha256/,/if-no-files-found: error/,/retention-days: 30/,/overwrite: false/,/Record Core Release artifact receipt/,/Existing independent Cloud, Generation, Attestation, Ledger, Release Integrity, UI, capacity and other evidence gates remain authoritative/,/does not deploy Production/,/Email\/WhatsApp\/SMS/]) assert.match(workflow,pattern);
assert.equal((workflow.match(/npm ci --no-audit --no-fund/g)||[]).length,1,"Core Release Gate must install dependencies exactly once.");
assert.equal((workflow.match(/npm run test:zero-cost/g)||[]).length,1,"Core Release Gate must run the shared zero-cost/provider safety suite exactly once.");
assert.equal((workflow.match(/npm run build/g)||[]).length,1,"Core Release Gate must run the integrated Next.js build exactly once.");
for(const pattern of [/const bytes=`\$\{JSON\.stringify\(manifest,null,2\)\}\\n`/,/crypto\.createHash\("sha256"\)\.update\(bytes\)/,/core-release-gate-manifest\.json\.sha256/,/Exact-file manifest SHA-256/]) assert.match(manifestSource,pattern);
const preservedIndependentGates=[".github/workflows/cloud-independent.yml",".github/workflows/generation-independent.yml",".github/workflows/production-evidence-attestation.yml",".github/workflows/production-evidence-ledger.yml",".github/workflows/release-integrity-chain.yml",".github/workflows/18-page-interaction-integrity.yml"];
for(const path of preservedIndependentGates)assert.equal(fs.existsSync(path),true,`Independent evidence gate must remain present: ${path}`);
for(const forbidden of [/continue-on-error:\s*true/,/allow_failure/i,/if:\s*always\(\)/,/workflow_run:/,/SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|OPENAI_API_KEY|VERCEL_TOKEN/]) assert.doesNotMatch(workflow,forbidden);
console.log("✓ Core Release Gate directly validates Cloud + Generation + shared zero-cost/provider safety + Attestation + Ledger/Replay + Release Integrity");
console.log("✓ Dependencies, zero-cost suite and integrated Next.js build each run once in the consolidated job");
console.log("✓ Core manifest digest covers exact file bytes and is retained with a matching SHA-256 sidecar + GitHub artifact receipt");
console.log("✓ Exact PR head/main SHA is checked out and re-verified before any core contract executes");
console.log("✓ Existing independent evidence gates remain present; Core verdict remains CODE + CI + build only");
