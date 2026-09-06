import assert from 'node:assert/strict';
import {verifyVideoSLO,verifyCapacityAndBackpressure,verifyVideoUnitEconomics,classifyVideoIncident,buildVideoAutoDegradePlan,evaluateVideoScaleReadiness} from '../lib/video/commercial-ga-scale-operations.js';

assert.equal(verifyVideoSLO({availability:.999,successRate:.98,p95QueueSeconds:12,p95CompletionMinutes:5,errorBudgetBurn:.4}).ok,true);
assert.equal(verifyVideoSLO({availability:.99,successRate:.98,p95QueueSeconds:12,p95CompletionMinutes:5,errorBudgetBurn:.4}).ok,false);
assert.equal(verifyCapacityAndBackpressure({concurrencyLimit:100,observedPeakConcurrency:80,queueDepth:30,maxQueueDepth:200,admissionControlVerified:true,backpressureVerified:true,loadSheddingVerified:true}).ok,true);
assert.equal(verifyCapacityAndBackpressure({concurrencyLimit:100,observedPeakConcurrency:120,queueDepth:30,maxQueueDepth:200,admissionControlVerified:true,backpressureVerified:true,loadSheddingVerified:true}).ok,false);
assert.equal(verifyVideoUnitEconomics({averageProviderCost:0.6,averageRevenue:1.2,p95ProviderCost:0.9,maxAllowedProviderCost:1,refundReserveRatio:.03,grossMarginFloor:.25}).ok,true);
assert.equal(verifyVideoUnitEconomics({averageProviderCost:1,averageRevenue:1.1,p95ProviderCost:1.4,maxAllowedProviderCost:1.2,refundReserveRatio:.01,grossMarginFloor:.25}).ok,false);
assert.equal(classifyVideoIncident({safetyBreach:true}),'SEV0');
assert.equal(classifyVideoIncident({providerOutage:true}),'SEV1');
assert.equal(classifyVideoIncident({errorRate:.1}),'SEV2');
assert.equal(classifyVideoIncident({latencyMultiplier:2}),'SEV3');
assert.equal(buildVideoAutoDegradePlan({severity:'SEV1'}).rollback,true);
assert.equal(buildVideoAutoDegradePlan({severity:'SEV0'}).acceptNewJobs,false);
const full=evaluateVideoScaleReadiness({
  slo:{availability:.999,successRate:.98,p95QueueSeconds:10,p95CompletionMinutes:4,errorBudgetBurn:.5},
  capacity:{concurrencyLimit:200,observedPeakConcurrency:150,queueDepth:80,maxQueueDepth:500,admissionControlVerified:true,backpressureVerified:true,loadSheddingVerified:true},
  economics:{averageProviderCost:.5,averageRevenue:1.1,p95ProviderCost:.8,maxAllowedProviderCost:1,refundReserveRatio:.03,grossMarginFloor:.25},
});
assert.equal(full.ok,true);
assert.equal(full.truth,'SCALE_OPERATIONS_VERIFIED');
console.log('AI Video scale operations contract: PASS');
