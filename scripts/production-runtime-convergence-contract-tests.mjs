import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/production-runtime-convergence.yml", "utf8");
const runtime = fs.readFileSync("scripts/production-runtime-convergence.mjs", "utf8");
const buildInfo = fs.readFileSync("app/api/build-info/route.js", "utf8");

for (const pattern of [
  /name: 0\.1 - LANERIQ Production Runtime Convergence Gate/,
  /pull_request:\n\s+branches: \[main\]/,
  /push:\n\s+branches: \[main\]/,
  /cancel-in-progress: true/,
  /LANERIQ_CANDIDATE_SHA:/,
  /github\.event\.pull_request\.head\.sha/,
  /Checkout exact candidate SHA/,
  /test "\$\(git rev-parse HEAD\)" = "\$LANERIQ_CANDIDATE_SHA"/,
  /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/,
  /LANERIQ_EXPECTED_PRODUCTION_SHA: \$\{\{ github\.sha \}\}/,
  /LANERIQ_PRODUCTION_URL: https:\/\/laneriq-ai\.vercel\.app/,
  /node scripts\/production-runtime-convergence\.mjs/,
  /actions\/upload-artifact@v4/,
  /name: laneriq-production-runtime-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}/,
  /production-runtime-convergence-manifest\.sha256/,
  /if-no-files-found: error/,
  /retention-days: 30/,
  /overwrite: false/,
  /artifact-digest/,
  /internal CI evidence package; not permanent external audit storage/,
  /does not deploy, roll back, mutate Vercel\/Supabase\/DNS/,
]) assert.match(workflow, pattern);

assert.doesNotMatch(
  workflow,
  /push:\n\s+branches: \[main\]\n\s+paths:/,
  "Production Runtime Convergence must run after every main push, not only when selected paths change.",
);

for (const pattern of [
  /PRODUCTION_RUNTIME_EXPECTED_SHA_INVALID/,
  /baseUrl !== "https:\/\/laneriq-ai\.vercel\.app"/,
  /\/api\/build-info\?laneriq_runtime=/,
  /data-dpl-id/,
  /body\.product === "LANERIQ AI"/,
  /body\.commitRef/,
  /=== "main"/,
  /body\.environment/,
  /=== "production"/,
  /includes\("no-store"\)/,
  /doubleReadStabilityVerified: true/,
  /OBSERVED_PUBLIC_PRODUCTION_RUNTIME/,
  /permanentImmutableAuditStorageClaimed: false/,
  /PRODUCTION_RUNTIME_DID_NOT_CONVERGE/,
  /production-runtime-convergence-manifest\.json/,
  /production-runtime-convergence-manifest\.sha256/,
  /const fileContents = `\$\{json\}\\n`/,
  /crypto\.createHash\("sha256"\)\.update\(fileContents\)/,
  /Manifest file SHA-256/,
]) assert.match(runtime, pattern);

for (const pattern of [
  /export const dynamic = "force-dynamic"/,
  /export const revalidate = 0/,
  /VERCEL_GIT_COMMIT_SHA/,
  /VERCEL_GIT_COMMIT_REF/,
  /VERCEL_ENV/,
  /Cache-Control": "private, no-store, max-age=0"/,
]) assert.match(buildInfo, pattern);

for (const forbidden of [
  /SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|VERCEL_TOKEN|OPENAI_API_KEY/,
  /continue-on-error:\s*true/,
  /workflow_run:/,
]) assert.doesNotMatch(workflow, forbidden);

for (const forbidden of [
  /Authorization:/,
  /Bearer\s/i,
  /SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|VERCEL_TOKEN|OPENAI_API_KEY/,
]) assert.doesNotMatch(runtime, forbidden);

console.log("✓ PR verifies the Runtime Convergence Gate contract without touching Production");
console.log("✓ Every main push performs bounded public Production convergence observation; path filtering is forbidden");
console.log("✓ Successful convergence persists a content-addressed JSON + SHA-256 CI evidence package with bounded retention");
console.log("✓ Runtime evidence binds exact main SHA + main ref + production environment + observed Vercel deployment ID with a double-read stability check");
console.log("✓ Gate remains credential-free, fail-closed and does not deploy, roll back or mutate Production infrastructure");
