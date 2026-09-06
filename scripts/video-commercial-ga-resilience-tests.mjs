import assert from 'node:assert/strict';
import {
  evaluateProviderCircuitBreaker,
  verifyCrossProviderFailover,
  detectBillingAnomalies,
  verifyBenchmarkIntegrity,
  verifyGACanary,
  evaluateVideoGAResilience,
} from '../lib/video/commercial-ga-resilience.js';

const SHA='a'.repeat(64);

const circuit=evaluateProviderCircuitBreaker({providerId:'p1',windowRequests:100,failures:2,timeouts:1,consecutiveFailures:0});
assert.equal(circuit.ok,true);
assert.equal(circuit.state,'CLOSED');
assert.equal(circuit.dispatchAllowed,true);
assert.equal(evaluateProviderCircuitBreaker({providerId:'p1',windowRequests:20,failures:3,timeouts:2,consecutiveFailures:3}).state,'OPEN');

const failover=verifyCrossProviderFailover({primaryProviderId:'p1',fallbackProviderId:'p2',primaryCircuitState:'OPEN',fallbackConnected:true,fallbackCapabilityVerified:true,failoverExecutionCount:4,independentEvidence:true});
assert.equal(failover.ok,true);
assert.equal(failover.automaticPaidEscalationAllowed,false);

const billing=detectBillingAnomalies({quotedCost:3,chargedCost:3,refundAmount:0,jobSucceeded:true,duplicateChargeCount:0,spendCap:5,ledgerBalanced:true});
assert.equal(billing.ok,true);
assert.equal(detectBillingAnomalies({quotedCost:3,chargedCost:4,jobSucceeded:true,ledgerBalanced:true}).ok,false);

const cleanSamples=Array.from({length:100},(_,i)=>({sampleId:`s-${i}`,artifactHash:i.toString(16).padStart(64,'0'),syntheticFixture:false,blindedReview:true,promptLeakageDetected:false}));
assert.equal(verifyBenchmarkIntegrity({samples:cleanSamples}).ok,true);
const contaminated=[...cleanSamples,{...cleanSamples[0],sampleId:'dup'}];
assert.equal(verifyBenchmarkIntegrity({samples:contaminated}).ok,false);

const canary=verifyGACanary({releaseId:'r1',gitSha:SHA,canaryPercent:10,observedJobs:80,successRate:0.99,errorBudgetBurn:0.2,rollbackReady:true,rollbackTested:true,productionMetricsIndependent:true});
assert.equal(canary.ok,true);
assert.equal(canary.automaticFullRolloutAllowed,false);

const full=evaluateVideoGAResilience({
  circuit:{providerId:'p1',windowRequests:100,failures:2,timeouts:1,consecutiveFailures:0},
  failover:{primaryProviderId:'p1',fallbackProviderId:'p2',primaryCircuitState:'OPEN',fallbackConnected:true,fallbackCapabilityVerified:true,failoverExecutionCount:5,independentEvidence:true},
  billing:{quotedCost:3,chargedCost:3,jobSucceeded:true,duplicateChargeCount:0,spendCap:5,ledgerBalanced:true},
  benchmark:{samples:cleanSamples},
  canary:{releaseId:'r1',gitSha:SHA,canaryPercent:10,observedJobs:80,successRate:0.99,errorBudgetBurn:0.2,rollbackReady:true,rollbackTested:true,productionMetricsIndependent:true},
});
assert.equal(full.ok,true);
assert.equal(full.truth,'GA_RESILIENCE_VERIFIED');

console.log('AI Video Commercial GA resilience contract: PASS');
