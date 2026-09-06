import assert from 'node:assert/strict';
import {AI_IMAGE_MARKET_LAYERS,AI_IMAGE_MARKET_POLICY,assessAiImageMarketReadiness} from '../lib/ai/image-market-readiness.js';

assert.deepEqual(AI_IMAGE_MARKET_LAYERS,[
  'production-runtime-wiring','real-provider-output-proof','commercial-reliability-gate','market-release-gate'
]);
assert.equal(AI_IMAGE_MARKET_POLICY.minVerifiedOutputs,20);
assert.equal(AI_IMAGE_MARKET_POLICY.minQualityScore,88);
assert.equal(AI_IMAGE_MARKET_POLICY.minReliabilitySamples,100);
assert.equal(AI_IMAGE_MARKET_POLICY.minSuccessRate,0.98);

const runtime={hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true};
const evidence={
  liveProviderVerified:true,
  verifiedOutputCount:20,
  qualityScore:92,
  productionEvidenceId:'prod-image-evidence-20',
  evidenceSha256:'a'.repeat(64),
  safetyPassed:true,
  provenanceVerified:true,
  outputValidated:true,
  observerSignedEvidence:true,
  artifactHashBound:true,
  providerSelfReported:false,
};
const reliability={
  sampleSize:100,
  successRate:.99,
  p95LatencyMs:18000,
  refundFailureRate:0,
  evidenceSha256:'b'.repeat(64),
  refundVerified:true,
  idempotencyVerified:true,
  rateLimitVerified:true,
  abusePressureVerified:true,
  alternateProviderAvailable:false,
  providerFailoverVerified:false,
};
const release={
  authenticatedProductionE2E:true,
  e2eEvidenceId:'prod-image-e2e-1',
  releaseEvidenceSha256:'c'.repeat(64),
  browserVerified:true,
  mobileVerified:true,
  abuseSuitePassed:true,
  monitoringReady:true,
  productionTarget:true,
  releaseApproved:true,
  mainSha:'d'.repeat(40),
  productionSha:'d'.repeat(40),
};

const codeOnly=assessAiImageMarketReadiness({runtime});
assert.equal(codeOnly.marketReady,false);
assert.equal(codeOnly.passedLayers,1);
assert.equal(codeOnly.truth,'EVIDENCE_REQUIRED');
assert.deepEqual(codeOnly.blockers,[
  'real-provider-output-proof-incomplete',
  'commercial-reliability-proof-incomplete',
  'market-release-proof-incomplete',
]);

const nineteen=assessAiImageMarketReadiness({runtime,evidence:{...evidence,verifiedOutputCount:19}});
assert.equal(nineteen.layers[1].passed,false,'19 real outputs must not close Layer 2');

const providerSelfReport=assessAiImageMarketReadiness({runtime,evidence:{...evidence,providerSelfReported:true}});
assert.equal(providerSelfReport.layers[1].passed,false,'provider self-report must never close Layer 2');

const unsignedObserver=assessAiImageMarketReadiness({runtime,evidence:{...evidence,observerSignedEvidence:false}});
assert.equal(unsignedObserver.layers[1].passed,false,'unsigned observer evidence must fail closed');

const noByteBinding=assessAiImageMarketReadiness({runtime,evidence:{...evidence,artifactHashBound:false}});
assert.equal(noByteBinding.layers[1].passed,false,'observer evidence must bind to captured provider bytes');

const ninetyNineSamples=assessAiImageMarketReadiness({runtime,evidence,reliability:{...reliability,sampleSize:99}});
assert.equal(ninetyNineSamples.layers[2].passed,false,'99 reliability samples must not close Layer 3');

const slowP95=assessAiImageMarketReadiness({runtime,evidence,reliability:{...reliability,p95LatencyMs:45001}});
assert.equal(slowP95.layers[2].passed,false,'p95 above 45 seconds must fail Layer 3');

const refundFailure=assessAiImageMarketReadiness({runtime,evidence,reliability:{...reliability,refundFailureRate:.001}});
assert.equal(refundFailure.layers[2].passed,false,'any measured refund failure must fail Layer 3');

const alternateNoFailover=assessAiImageMarketReadiness({runtime,evidence,reliability:{...reliability,alternateProviderAvailable:true,providerFailoverVerified:false}});
assert.equal(alternateNoFailover.layers[2].passed,false,'eligible alternate provider requires failover proof');

const noAlternateNeeded=assessAiImageMarketReadiness({runtime,evidence,reliability});
assert.equal(noAlternateNeeded.layers[2].passed,true,'failover proof is not fabricated when no alternate eligible provider exists');

const previewOnly=assessAiImageMarketReadiness({runtime,evidence,reliability,release:{...release,productionTarget:false}});
assert.equal(previewOnly.layers[3].passed,false,'Preview deployment can never close the Production market release gate');

const shaDrift=assessAiImageMarketReadiness({runtime,evidence,reliability,release:{...release,productionSha:'e'.repeat(40)}});
assert.equal(shaDrift.layers[3].passed,false,'main and Production SHA drift must block Layer 4');

const noApproval=assessAiImageMarketReadiness({runtime,evidence,reliability,release:{...release,releaseApproved:false}});
assert.equal(noApproval.layers[3].passed,false,'market release requires explicit approval');

const ready=assessAiImageMarketReadiness({runtime,evidence,reliability,release});
assert.equal(ready.marketReady,true);
assert.equal(ready.decision,'MARKET_SALES_READY');
assert.equal(ready.passedLayers,4);
assert.equal(ready.truth,'PRODUCTION_LIVE_VERIFIED');
assert.deepEqual(ready.blockers,[]);

console.log('AI Image four-layer market readiness contracts passed with strict Layer 2-4 evidence semantics.');
