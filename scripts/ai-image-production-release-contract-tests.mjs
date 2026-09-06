import assert from 'node:assert/strict';
import fs from 'node:fs';

const verifier=fs.readFileSync('scripts/image-market-production-verify.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/ai-image-production-release-verify.yml','utf8');

for(const pattern of [
  /market\?\.marketReady!==true/,
  /PRODUCTION_LIVE_VERIFIED/,
  /evidenceBundleVerified!==true/,
  /passedLayers\)!==4/,
  /productionTarget!==true/,
  /release\?\.mainSha/,
  /release\?\.productionSha/,
  /IMAGE_MARKET_EXPECTED_MAIN_SHA/,
  /code\?\.marketSalesReady!==true/,
  /\/api\/images\/market-readiness/,
  /\/api\/images\/readiness/,
])assert.match(verifier,pattern);
assert.doesNotMatch(verifier,/method\s*:\s*['"]POST['"]/,'Production verifier must remain read-only.');
assert.match(verifier,/redirect:'error'/);
assert.match(verifier,/AbortController/);
assert.match(verifier,/MAX_BYTES/);

assert.match(workflow,/workflow_dispatch:/);
assert.match(workflow,/GITHUB_REF_NAME.*main/);
assert.match(workflow,/ref: main/);
assert.match(workflow,/git rev-parse HEAD/);
assert.match(workflow,/IMAGE_MARKET_EXPECTED_MAIN_SHA/);
assert.match(workflow,/node scripts\/image-market-production-verify\.mjs/);
assert.doesNotMatch(workflow,/IMAGE_GENERATION_TOKEN|IMAGE_QUALITY_OBSERVER_TOKEN|IMAGE_MARKET_EVIDENCE_SIGNING_SECRET/,'Read-only Production verifier must not require provider or evidence signing secrets.');

console.log('AI Image external Production release verification contract passed.');
