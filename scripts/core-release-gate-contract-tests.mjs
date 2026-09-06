import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

const workflowPath = '.github/workflows/core-release-gate.yml';
const manifestPath = 'scripts/core-release-gate-manifest.mjs';

assert.ok(exists(workflowPath), 'CORE_RELEASE_GATE_WORKFLOW_MISSING');
assert.ok(exists(manifestPath), 'CORE_RELEASE_GATE_MANIFEST_SCRIPT_MISSING');

const workflow = read(workflowPath);
const manifest = read(manifestPath);

const requiredWorkflowContracts = [
  'LANERIQ_CANDIDATE_SHA:',
  'Checkout exact candidate SHA',
  'ref: ${{ env.LANERIQ_CANDIDATE_SHA }}',
  'Verify exact checkout identity',
  'test "$actual" = "$LANERIQ_CANDIDATE_SHA"',
  'Core 1/6 — Cloud boundary',
  'node services/cloud/test/contract.mjs',
  'Core 2/6 — Generation boundary',
  'node services/generation/test/contract.mjs',
  'Core 3/6 — Zero-cost and provider safety',
  'npm run test:zero-cost',
  'Core 4/6 — Production evidence attestation',
  'node scripts/production-evidence-attestation-contract-tests.mjs',
  'Core 5/6 — Immutable evidence ledger and replay',
  'node scripts/production-evidence-ledger-contract-tests.mjs',
  'Core 6/6 — Release integrity chain',
  'node scripts/release-integrity-chain-contract-tests.mjs',
  'Build Next.js runtime once',
  'npm run build',
  'Emit exact-SHA core release manifest',
  'node scripts/core-release-gate-manifest.mjs',
  'Record Core Release artifact receipt',
  'production/runtime/external evidence',
];

for (const contract of requiredWorkflowContracts) {
  assert.ok(workflow.includes(contract), `CORE_RELEASE_GATE_CONTRACT_MISSING:${contract}`);
}

const requiredManifestContracts = [
  'CORE_RELEASE_GATE_SHA_INVALID',
  'gate:"CORE_RELEASE_GATE_V1"',
  'evidenceLevel:"CODE_CI_BUILD"',
  'candidateSha:sha',
  'exactCandidateShaVerified:true',
  'codeContractsVerified:true',
  'integratedBuildVerified:true',
  'productionRuntimeVerified:false',
  'providerLiveOutputVerified:false',
  'physicalDeviceVerified:false',
  'independentThirdPartyAuditVerified:false',
  'officialStoreSubmissionVerified:false',
  'productionMutationPerformed:false',
  'supabaseMutationPerformed:false',
  'emailDeliveryAdvanced:false',
  'whatsappDeliveryAdvanced:false',
  'smsDeliveryAdvanced:false',
  'core-release-gate-manifest.json.sha256',
];

for (const contract of requiredManifestContracts) {
  assert.ok(manifest.includes(contract), `CORE_RELEASE_GATE_MANIFEST_CONTRACT_MISSING:${contract}`);
}

for (const path of [
  'services/cloud/test/contract.mjs',
  'services/generation/test/contract.mjs',
  'scripts/production-evidence-attestation-contract-tests.mjs',
  'scripts/production-evidence-ledger-contract-tests.mjs',
  'scripts/release-integrity-chain-contract-tests.mjs',
  'scripts/core-release-gate-manifest.mjs',
]) {
  assert.ok(exists(path), `CORE_RELEASE_GATE_DEPENDENCY_MISSING:${path}`);
}

console.log('CORE_RELEASE_GATE_CONTRACT=PASS');
console.log('EVIDENCE_LEVEL=CODE_CI_ONLY');
console.log('PRODUCTION_RUNTIME_VERIFIED=false');
