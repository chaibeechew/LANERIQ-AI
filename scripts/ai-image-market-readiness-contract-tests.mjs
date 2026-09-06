import assert from 'node:assert/strict';
import {AI_IMAGE_MARKET_LAYERS,AI_IMAGE_MARKET_POLICY,assessAiImageMarketReadiness} from '../lib/ai/image-market-readiness.js';

assert.deepEqual(AI_IMAGE_MARKET_LAYERS,[
  'production-runtime-wiring','real-provider-output-proof','commercial-reliability-gate','market-release-gate'
]);
assert.equal(AI_IMAGE_MARKET_POLICY.minQualityScore,88);
assert.equal(AI_IMAGE_MARKET_POLICY.minSuccessRate,0.98);

const codeOnly=assessAiImageMarketReadiness({
  runtime:{hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true},
});
assert.equal(codeOnly.marketReady,false);
assert.equal(codeOnly.passedLayers,1);
assert.equal(codeOnly.truth,'EVIDENCE_REQUIRED');

const fakeLive=assessAiImageMarketReadiness({
  runtime:{hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true},
  evidence:{liveProviderVerified:true,verifiedOutputCount:19,qualityScore:99,safetyPassed:true,provenanceVerified:true,outputValidated:true},
});
assert.equal(fakeLive.marketReady,false);
assert.equal(fakeLive.layers[1].passed,false);

const ready=assessAiImageMarketReadiness({
  runtime:{hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true},
  evidence:{liveProviderVerified:true,verifiedOutputCount:100,qualityScore:94,safetyPassed:true,provenanceVerified:true,outputValidated:true},
  reliability:{successRate:.995,p95LatencyMs:12000,refundFailureRate:0,idempotencyVerified:true,providerFailoverVerified:true,rateLimitVerified:true},
  release:{authenticatedProductionE2E:true,browserVerified:true,mobileVerified:true,abuseSuitePassed:true,monitoringReady:true,mainSha:'abc123',productionSha:'abc123'},
});
assert.equal(ready.marketReady,true);
assert.equal(ready.decision,'MARKET_SALES_READY');
assert.equal(ready.passedLayers,4);
assert.equal(ready.truth,'PRODUCTION_LIVE_VERIFIED');

const shaDrift=assessAiImageMarketReadiness({
  runtime:{hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true},
  evidence:{liveProviderVerified:true,verifiedOutputCount:100,qualityScore:94,safetyPassed:true,provenanceVerified:true,outputValidated:true},
  reliability:{successRate:.995,p95LatencyMs:12000,refundFailureRate:0,idempotencyVerified:true,providerFailoverVerified:true,rateLimitVerified:true},
  release:{authenticatedProductionE2E:true,browserVerified:true,mobileVerified:true,abuseSuitePassed:true,monitoringReady:true,mainSha:'abc123',productionSha:'def456'},
});
assert.equal(shaDrift.marketReady,false);
assert.equal(shaDrift.layers[3].passed,false);

console.log('AI Image four-layer market readiness contracts passed.');
