const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const finite=value=>Number.isFinite(Number(value));
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

export function evaluateProviderCircuitBreaker({providerId='',windowRequests=0,failures=0,timeouts=0,consecutiveFailures=0,recoveryProbePassed=false}={}){
  const blockers=[];
  const requests=Math.max(0,Number(windowRequests)||0);
  const failed=Math.max(0,Number(failures)||0);
  const timeoutCount=Math.max(0,Number(timeouts)||0);
  const failureRate=requests>0?(failed+timeoutCount)/requests:0;
  let state='CLOSED';
  if(consecutiveFailures>=3||failureRate>=0.2) state='OPEN';
  if(recoveryProbePassed===true&&state==='OPEN') state='HALF_OPEN';
  if(!clean(providerId)) blockers.push('PROVIDER_ID_REQUIRED');
  if(requests<10) blockers.push('CIRCUIT_SAMPLE_LT_10');
  return freeze({ok:blockers.length===0,providerId:clean(providerId)||null,state,failureRate,blockers:freeze(blockers),dispatchAllowed:state==='CLOSED'});
}

export function verifyCrossProviderFailover({primaryProviderId='',fallbackProviderId='',primaryCircuitState='',fallbackConnected=false,fallbackCapabilityVerified=false,failoverExecutionCount=0,independentEvidence=false}={}){
  const blockers=[];
  if(!clean(primaryProviderId)) blockers.push('PRIMARY_PROVIDER_REQUIRED');
  if(!clean(fallbackProviderId)||clean(primaryProviderId)===clean(fallbackProviderId)) blockers.push('DISTINCT_FALLBACK_PROVIDER_REQUIRED');
  if(!['OPEN','HALF_OPEN'].includes(clean(primaryCircuitState).toUpperCase())) blockers.push('PRIMARY_CIRCUIT_NOT_FAILED');
  if(fallbackConnected!==true) blockers.push('FALLBACK_NOT_CONNECTED');
  if(fallbackCapabilityVerified!==true) blockers.push('FALLBACK_CAPABILITY_UNVERIFIED');
  if(Number(failoverExecutionCount)<3) blockers.push('FAILOVER_EXECUTIONS_LT_3');
  if(independentEvidence!==true) blockers.push('FAILOVER_INDEPENDENT_EVIDENCE_REQUIRED');
  return freeze({ok:blockers.length===0,blockers:freeze(blockers),automaticPaidEscalationAllowed:false});
}

export function detectBillingAnomalies({quotedCost=0,chargedCost=0,refundAmount=0,jobSucceeded=false,jobCancelled=false,duplicateChargeCount=0,spendCap=Infinity,ledgerBalanced=false}={}){
  const anomalies=[];
  const quote=Number(quotedCost)||0,charge=Number(chargedCost)||0,refund=Number(refundAmount)||0,cap=Number(spendCap);
  if(charge>quote+1e-9) anomalies.push('CHARGE_EXCEEDS_QUOTE');
  if(jobSucceeded!==true&&charge>0&&!jobCancelled) anomalies.push('FAILED_JOB_CHARGED');
  if(jobCancelled===true&&charge>0&&refund<charge) anomalies.push('CANCEL_REFUND_INCOMPLETE');
  if(Number(duplicateChargeCount)>0) anomalies.push('DUPLICATE_CHARGE_DETECTED');
  if(finite(cap)&&charge>cap) anomalies.push('SPEND_CAP_EXCEEDED');
  if(ledgerBalanced!==true) anomalies.push('LEDGER_NOT_RECONCILED');
  return freeze({ok:anomalies.length===0,anomalies:freeze(anomalies),billingPromotionAllowed:anomalies.length===0});
}

export function verifyBenchmarkIntegrity({samples=[]}={}){
  const blockers=[];
  const list=Array.isArray(samples)?samples:[];
  const ids=new Set(),hashes=new Set();
  let duplicates=0,synthetic=0,unblinded=0;
  for(const sample of list){
    const id=clean(sample.sampleId),hash=clean(sample.artifactHash);
    if(!id) blockers.push('SAMPLE_ID_REQUIRED');
    else if(ids.has(id)){duplicates++;blockers.push(`DUPLICATE_SAMPLE_ID:${id}`);} else ids.add(id);
    if(!sha256(hash)) blockers.push(`ARTIFACT_HASH_INVALID:${id||'unknown'}`);
    else if(hashes.has(hash)){duplicates++;blockers.push(`DUPLICATE_ARTIFACT_HASH:${id||'unknown'}`);} else hashes.add(hash);
    if(sample.syntheticFixture===true){synthetic++;blockers.push(`SYNTHETIC_SAMPLE_REJECTED:${id||'unknown'}`);}
    if(sample.blindedReview!==true){unblinded++;blockers.push(`BLINDED_REVIEW_REQUIRED:${id||'unknown'}`);}
    if(sample.promptLeakageDetected===true) blockers.push(`BENCHMARK_CONTAMINATION:${id||'unknown'}`);
  }
  return freeze({ok:blockers.length===0,sampleCount:list.length,duplicates,synthetic,unblinded,blockers:freeze(blockers)});
}

export function verifyGACanary({releaseId='',gitSha='',canaryPercent=0,observedJobs=0,successRate=0,errorBudgetBurn=1,rollbackReady=false,rollbackTested=false,productionMetricsIndependent=false}={}){
  const blockers=[];
  if(!clean(releaseId)) blockers.push('RELEASE_ID_REQUIRED');
  if(!sha256(gitSha)) blockers.push('GIT_SHA_INVALID');
  const pct=Number(canaryPercent)||0;
  if(pct<=0||pct>25) blockers.push('CANARY_PERCENT_OUT_OF_RANGE');
  if(Number(observedJobs)<50) blockers.push('CANARY_OBSERVED_JOBS_LT_50');
  if(Number(successRate)<0.97) blockers.push('CANARY_SUCCESS_RATE_LT_97_PERCENT');
  if(Number(errorBudgetBurn)>0.5) blockers.push('ERROR_BUDGET_BURN_TOO_HIGH');
  if(rollbackReady!==true) blockers.push('ROLLBACK_NOT_READY');
  if(rollbackTested!==true) blockers.push('ROLLBACK_NOT_TESTED');
  if(productionMetricsIndependent!==true) blockers.push('INDEPENDENT_PRODUCTION_METRICS_REQUIRED');
  return freeze({ok:blockers.length===0,blockers:freeze(blockers),expandTrafficAllowed:blockers.length===0,automaticFullRolloutAllowed:false});
}

export function evaluateVideoGAResilience(input={}){
  const circuit=evaluateProviderCircuitBreaker(input.circuit);
  const failover=verifyCrossProviderFailover(input.failover);
  const billing=detectBillingAnomalies(input.billing);
  const benchmark=verifyBenchmarkIntegrity(input.benchmark);
  const canary=verifyGACanary(input.canary);
  const blockers=[...circuit.blockers,...failover.blockers,...billing.anomalies,...benchmark.blockers,...canary.blockers];
  return freeze({ok:blockers.length===0,circuit,failover,billing,benchmark,canary,blockers:freeze(blockers),truth:blockers.length===0?'GA_RESILIENCE_VERIFIED':'GA_RESILIENCE_EVIDENCE_REQUIRED'});
}
