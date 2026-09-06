import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const sha='d'.repeat(40);
const outputs=Array.from({length:20},(_,index)=>({
  requestId:`output-${index+1}`,
  truth:'REAL_OUTPUT_QUALITY_VERIFIED',
  providerSelfReported:false,
  observerSignedEvidence:true,
  artifactHashBound:true,
  safetyPassed:true,
  provenanceVerified:true,
  outputValidated:true,
  artifactSha256:(index.toString(16).padStart(2,'0')+'a'.repeat(62)).slice(0,64),
  qualityScore:90+(index%5),
}));
const reliabilitySamples=Array.from({length:100},(_,index)=>({
  requestId:`sample-${index+1}`,
  success:index<99,
  latencyMs:12000+(index%10)*500,
  charged:index===99,
  refundSucceeded:index===99,
}));
const base={
  schemaVersion:1,
  productionEvidenceId:'image-prod-proof-20',
  outputs,
  reliabilitySamples,
  attestations:{refundVerified:true,idempotencyVerified:true,rateLimitVerified:true,abusePressureVerified:true,alternateProviderAvailable:false,providerFailoverVerified:false},
  release:{authenticatedProductionE2E:true,e2eEvidenceId:'image-e2e-proof-1',browserVerified:true,mobileVerified:true,abuseSuitePassed:true,monitoringReady:true,releaseApproved:true,productionTarget:true,mainSha:sha,productionSha:sha},
};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laneriq-image-evidence-'));
const file=path.join(dir,'evidence.json');
function run(manifest){
  fs.writeFileSync(file,JSON.stringify(manifest));
  const result=spawnSync(process.execPath,['scripts/image-market-evidence-bundle.mjs',file],{encoding:'utf8',env:{...process.env,IMAGE_MARKET_EVIDENCE_SIGNING_SECRET:'market-evidence-signing-secret-0123456789abcdef'}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout);
}
try{
  let result=run(base);
  assert.equal(result.rawCounts.outputsVerified,20);
  assert.equal(result.rawCounts.samplesValid,100);
  assert.equal(result.bundle.evidence.verifiedOutputCount,20);
  assert.ok(result.bundle.evidence.qualityScore>=88);
  assert.equal(result.bundle.reliability.sampleSize,100);
  assert.ok(result.bundle.reliability.successRate>=.98);
  assert.ok(result.bundle.reliability.p95LatencyMs<=45000);
  assert.equal(result.bundle.reliability.refundFailureRate,0);
  assert.equal(result.assessment.marketReady,true);
  assert.match(result.signature,/^[a-f0-9]{64}$/);
  assert.ok(result.encodedBundle);

  result=run({...base,outputs:base.outputs.slice(0,19)});
  assert.equal(result.assessment.marketReady,false);
  assert.ok(result.assessment.blockers.includes('real-provider-output-proof-incomplete'));

  result=run({...base,reliabilitySamples:base.reliabilitySamples.slice(0,99)});
  assert.equal(result.assessment.marketReady,false);
  assert.ok(result.assessment.blockers.includes('commercial-reliability-proof-incomplete'));

  result=run({...base,outputs:[...base.outputs.slice(0,19),{...base.outputs[19],providerSelfReported:true}]});
  assert.equal(result.rawCounts.outputsVerified,19,'provider self-report is discarded from verified output count');
  assert.equal(result.assessment.marketReady,false);

  console.log('AI Image raw evidence aggregation contracts passed.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
