import assert from 'node:assert/strict';
import {evaluateFinalVideoCommercialClosure,verifyExactProductionClosure} from '../lib/video/commercial-ga-final-closure.js';

const SHA='b'.repeat(64);
const full=evaluateFinalVideoCommercialClosure({
  realProviderLaunch:{productionProviderConnected:true,productionCredentialVerified:true,textToVideoExecutions:3,imageToVideoExecutions:3,videoToVideoExecutions:3,durableArtifactsVerified:true,signedRuntimeEvidenceVerified:true,independentVerifierVerified:true},
  paidBeta:{paidUserJobs:40,successfulPaidJobs:39,billingLedgerVerified:true,failedJobNoChargeVerified:true,cancellationRefundVerified:true,durableMp4Verified:true,reopenVerified:true,timeoutRecoveryVerified:true,providerRetryVerified:true,canaryVerified:true,supportRunbookReady:true},
  benchmarkLoad:{realSamples:150,categories:8,acceptedRate:.93,p95QualityScore:90,safetyPassRate:1,peakConcurrentJobs:80,testedConcurrencyLimit:100,maxObservedQueueDepth:35,queueDepthLimit:50,loadSheddingVerified:true,backpressureVerified:true,failureInjectionVerified:true,p95QueueSeconds:12,p95CompletionMinutes:5.2,unitEconomicsVerified:true},
  production:{githubMainSha:SHA,vercelProductionSha:SHA,runtimeSha:SHA,productionDeploymentReady:true,browserSmokeVerified:true,apiSmokeVerified:true,realVideoSmokeVerified:true,rollbackTested:true,canaryCompleted:true,releaseEvidenceBundleVerified:true,releaseControllerApproved:true},
});
assert.equal(full.ok,true);
assert.equal(full.passedLayers,4);
assert.equal(full.status,'COMMERCIAL_GA_SALE_READY');
assert.equal(full.automaticMergeAllowed,false);

const noEvidence=evaluateFinalVideoCommercialClosure({});
assert.equal(noEvidence.ok,false);
assert.equal(noEvidence.status,'SALE_BLOCKED');
assert.ok(noEvidence.blockers.length>0);

const mismatch=verifyExactProductionClosure({githubMainSha:SHA,vercelProductionSha:'c'.repeat(64),runtimeSha:SHA});
assert.equal(mismatch.ok,false);
assert.ok(mismatch.blockers.includes('GITHUB_VERCEL_SHA_MISMATCH'));

const beta=evaluateFinalVideoCommercialClosure({
 realProviderLaunch:{productionProviderConnected:true,productionCredentialVerified:true,textToVideoExecutions:1,imageToVideoExecutions:1,videoToVideoExecutions:1,durableArtifactsVerified:true,signedRuntimeEvidenceVerified:true,independentVerifierVerified:true},
 paidBeta:{paidUserJobs:20,successfulPaidJobs:20,billingLedgerVerified:true,failedJobNoChargeVerified:true,cancellationRefundVerified:true,durableMp4Verified:true,reopenVerified:true,timeoutRecoveryVerified:true,providerRetryVerified:true,canaryVerified:true,supportRunbookReady:true},
});
assert.equal(beta.paidBetaSaleReady,true);
assert.equal(beta.commercialGAReady,false);
assert.equal(beta.status,'PAID_BETA_SALE_READY');

console.log('AI Video final four-layer commercial closure contract: PASS');
