import assert from 'node:assert/strict';
import {
  VIDEO_COMMERCIAL_GA_GATES,
  VIDEO_COMMERCIAL_GA_STATUS,
  verifyLiveProviderGate,
  verifyRealOutputBenchmarkGate,
  verifyBillingGate,
  verifyReliabilityGate,
  verifyProductionReleaseGate,
  evaluateVideoCommercialGA,
} from '../lib/video/commercial-ga-gate.js';

const SHA='a'.repeat(64);

const live=verifyLiveProviderGate({
  providerConnected:true,
  productionCredentialVerified:true,
  capabilities:['text-to-video','image-to-video','video-to-video'],
  verifiedCapabilities:['text-to-video','image-to-video','video-to-video'],
  externalExecutionCount:6,
  providerSelfReportOnly:false,
});
assert.equal(live.id,VIDEO_COMMERCIAL_GA_GATES.LIVE_PROVIDER);
assert.equal(live.ok,true);
assert.equal(verifyLiveProviderGate({providerConnected:true,capabilities:['text-to-video'],providerSelfReportOnly:true}).ok,false);

const benchmark=verifyRealOutputBenchmarkGate({
  sampleCount:120,
  categoryCount:8,
  independentObservationCount:120,
  acceptedRate:0.93,
  p95QualityScore:91,
  safetyPassRate:1,
  provenanceCoverage:1,
  artifactHashCoverage:1,
});
assert.equal(benchmark.ok,true);
assert.equal(verifyRealOutputBenchmarkGate({sampleCount:99}).ok,false);

const billing=verifyBillingGate({
  requestIdempotencyVerified:true,
  quoteBeforeDispatchVerified:true,
  chargeAfterDurableSuccess:true,
  failedJobNoChargeVerified:true,
  cancellationRefundVerified:true,
  duplicateChargeProtection:true,
  hardSpendCapVerified:true,
  ledgerReconciliationVerified:true,
});
assert.equal(billing.ok,true);
assert.equal(verifyBillingGate({requestIdempotencyVerified:true}).ok,false);

const reliability=verifyReliabilityGate({
  completedJobs:150,
  successRate:0.98,
  timeoutRecoveryVerified:true,
  providerRetryVerified:true,
  idempotentReplayVerified:true,
  durableMp4Verified:true,
  reopenVerified:true,
  malwareScanVerified:true,
  p95QueueSeconds:9,
  p95CompletionMinutes:4.2,
});
assert.equal(reliability.ok,true);
assert.equal(verifyReliabilityGate({completedJobs:10,successRate:1}).ok,false);

const productionRelease=verifyProductionReleaseGate({
  githubMainSha:SHA,
  vercelProductionSha:SHA,
  runtimeVerifiedSha:SHA,
  productionDeploymentReady:true,
  browserSmokeVerified:true,
  apiSmokeVerified:true,
  rollbackVerified:true,
  releaseEvidenceIds:['gh-run-1','vercel-deploy-1','runtime-probe-1'],
});
assert.equal(productionRelease.ok,true);
assert.equal(verifyProductionReleaseGate({githubMainSha:SHA,vercelProductionSha:'b'.repeat(64),runtimeVerifiedSha:SHA}).ok,false);

const full=evaluateVideoCommercialGA({
  liveProvider:{providerConnected:true,productionCredentialVerified:true,capabilities:['text-to-video','image-to-video','video-to-video'],verifiedCapabilities:['text-to-video','image-to-video','video-to-video'],externalExecutionCount:6,providerSelfReportOnly:false},
  benchmark:{sampleCount:120,categoryCount:8,independentObservationCount:120,acceptedRate:0.93,p95QualityScore:91,safetyPassRate:1,provenanceCoverage:1,artifactHashCoverage:1},
  billing:{requestIdempotencyVerified:true,quoteBeforeDispatchVerified:true,chargeAfterDurableSuccess:true,failedJobNoChargeVerified:true,cancellationRefundVerified:true,duplicateChargeProtection:true,hardSpendCapVerified:true,ledgerReconciliationVerified:true},
  reliability:{completedJobs:150,successRate:0.98,timeoutRecoveryVerified:true,providerRetryVerified:true,idempotentReplayVerified:true,durableMp4Verified:true,reopenVerified:true,malwareScanVerified:true,p95QueueSeconds:9,p95CompletionMinutes:4.2},
  productionRelease:{githubMainSha:SHA,vercelProductionSha:SHA,runtimeVerifiedSha:SHA,productionDeploymentReady:true,browserSmokeVerified:true,apiSmokeVerified:true,rollbackVerified:true,releaseEvidenceIds:['gh','vercel','runtime']},
});
assert.equal(full.commercialGAReady,true);
assert.equal(full.status,VIDEO_COMMERCIAL_GA_STATUS.COMMERCIAL_GA_READY);
assert.equal(full.passedGates,5);
assert.equal(full.blockers.length,0);

const selfClaim=evaluateVideoCommercialGA({
  liveProvider:{providerConnected:true,productionCredentialVerified:true,capabilities:['text-to-video','image-to-video','video-to-video'],verifiedCapabilities:['text-to-video','image-to-video','video-to-video'],externalExecutionCount:999,providerSelfReportOnly:true},
});
assert.equal(selfClaim.commercialGAReady,false);
assert.ok(selfClaim.blockers.some(v=>v.includes('INDEPENDENT_PROVIDER_EVIDENCE_REQUIRED')));

console.log('AI Video Commercial GA five-gate contract: PASS');
