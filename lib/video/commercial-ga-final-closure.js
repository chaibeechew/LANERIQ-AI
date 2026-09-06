const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const finite=value=>Number.isFinite(Number(value));
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

function gate(id,ok,blockers=[],evidence={}){
  return freeze({id,ok,blockers:freeze([...blockers]),evidence:freeze({...evidence})});
}

export function verifyRealProviderLaunchClosure({
  productionProviderConnected=false,
  productionCredentialVerified=false,
  textToVideoExecutions=0,
  imageToVideoExecutions=0,
  videoToVideoExecutions=0,
  durableArtifactsVerified=false,
  signedRuntimeEvidenceVerified=false,
  independentVerifierVerified=false,
}={}){
  const blockers=[];
  if(!productionProviderConnected) blockers.push('PRODUCTION_PROVIDER_NOT_CONNECTED');
  if(!productionCredentialVerified) blockers.push('PRODUCTION_CREDENTIAL_NOT_VERIFIED');
  if(Number(textToVideoExecutions)<1) blockers.push('TEXT_TO_VIDEO_REAL_EXECUTION_REQUIRED');
  if(Number(imageToVideoExecutions)<1) blockers.push('IMAGE_TO_VIDEO_REAL_EXECUTION_REQUIRED');
  if(Number(videoToVideoExecutions)<1) blockers.push('VIDEO_TO_VIDEO_REAL_EXECUTION_REQUIRED');
  if(!durableArtifactsVerified) blockers.push('DURABLE_VIDEO_ARTIFACTS_REQUIRED');
  if(!signedRuntimeEvidenceVerified) blockers.push('SIGNED_RUNTIME_EVIDENCE_REQUIRED');
  if(!independentVerifierVerified) blockers.push('INDEPENDENT_PROVIDER_VERIFIER_REQUIRED');
  return gate('REAL_PROVIDER_LAUNCH',blockers.length===0,blockers,{textToVideoExecutions:Number(textToVideoExecutions)||0,imageToVideoExecutions:Number(imageToVideoExecutions)||0,videoToVideoExecutions:Number(videoToVideoExecutions)||0});
}

export function verifyPaidBetaClosure({
  paidUserJobs=0,
  successfulPaidJobs=0,
  billingLedgerVerified=false,
  failedJobNoChargeVerified=false,
  cancellationRefundVerified=false,
  durableMp4Verified=false,
  reopenVerified=false,
  timeoutRecoveryVerified=false,
  providerRetryVerified=false,
  canaryVerified=false,
  supportRunbookReady=false,
}={}){
  const blockers=[];
  const total=Number(paidUserJobs)||0;
  const success=Number(successfulPaidJobs)||0;
  if(total<20) blockers.push('PAID_BETA_REAL_JOB_COUNT_LT_20');
  if(total>0&&success/total<0.95) blockers.push('PAID_BETA_SUCCESS_RATE_LT_95_PERCENT');
  for(const [key,ok] of Object.entries({billingLedgerVerified,failedJobNoChargeVerified,cancellationRefundVerified,durableMp4Verified,reopenVerified,timeoutRecoveryVerified,providerRetryVerified,canaryVerified,supportRunbookReady})){
    if(ok!==true) blockers.push(`PAID_BETA_EVIDENCE_REQUIRED:${key}`);
  }
  return gate('PAID_BETA_CLOSURE',blockers.length===0,blockers,{paidUserJobs:total,successfulPaidJobs:success,successRate:total?success/total:0});
}

export function verifyRealBenchmarkLoadClosure({
  realSamples=0,
  categories=0,
  acceptedRate=0,
  p95QualityScore=0,
  safetyPassRate=0,
  peakConcurrentJobs=0,
  testedConcurrencyLimit=0,
  maxObservedQueueDepth=0,
  queueDepthLimit=0,
  loadSheddingVerified=false,
  backpressureVerified=false,
  failureInjectionVerified=false,
  p95QueueSeconds,
  p95CompletionMinutes,
  unitEconomicsVerified=false,
}={}){
  const blockers=[];
  if(Number(realSamples)<100) blockers.push('REAL_BENCHMARK_SAMPLE_COUNT_LT_100');
  if(Number(categories)<6) blockers.push('REAL_BENCHMARK_CATEGORY_COUNT_LT_6');
  if(Number(acceptedRate)<0.9) blockers.push('REAL_BENCHMARK_ACCEPTED_RATE_LT_90_PERCENT');
  if(Number(p95QualityScore)<85) blockers.push('REAL_BENCHMARK_P95_QUALITY_LT_85');
  if(Number(safetyPassRate)<0.995) blockers.push('REAL_BENCHMARK_SAFETY_LT_99_5_PERCENT');
  if(Number(testedConcurrencyLimit)<=0) blockers.push('CONCURRENCY_LIMIT_TEST_REQUIRED');
  if(Number(peakConcurrentJobs)<=0) blockers.push('PEAK_CONCURRENCY_EVIDENCE_REQUIRED');
  if(Number(peakConcurrentJobs)>Number(testedConcurrencyLimit)) blockers.push('PEAK_CONCURRENCY_EXCEEDED_TESTED_LIMIT');
  if(Number(queueDepthLimit)<=0) blockers.push('QUEUE_DEPTH_LIMIT_REQUIRED');
  if(Number(maxObservedQueueDepth)>Number(queueDepthLimit)) blockers.push('QUEUE_DEPTH_EXCEEDED_LIMIT');
  if(!loadSheddingVerified) blockers.push('LOAD_SHEDDING_EVIDENCE_REQUIRED');
  if(!backpressureVerified) blockers.push('BACKPRESSURE_EVIDENCE_REQUIRED');
  if(!failureInjectionVerified) blockers.push('FAILURE_INJECTION_EVIDENCE_REQUIRED');
  if(!finite(p95QueueSeconds)||Number(p95QueueSeconds)>30) blockers.push('P95_QUEUE_SLO_NOT_MET');
  if(!finite(p95CompletionMinutes)||Number(p95CompletionMinutes)>8) blockers.push('P95_COMPLETION_SLO_NOT_MET');
  if(!unitEconomicsVerified) blockers.push('UNIT_ECONOMICS_EVIDENCE_REQUIRED');
  return gate('REAL_BENCHMARK_LOAD',blockers.length===0,blockers,{realSamples:Number(realSamples)||0,categories:Number(categories)||0,peakConcurrentJobs:Number(peakConcurrentJobs)||0});
}

export function verifyExactProductionClosure({
  githubMainSha='',
  vercelProductionSha='',
  runtimeSha='',
  productionDeploymentReady=false,
  browserSmokeVerified=false,
  apiSmokeVerified=false,
  realVideoSmokeVerified=false,
  rollbackTested=false,
  canaryCompleted=false,
  releaseEvidenceBundleVerified=false,
  releaseControllerApproved=false,
}={}){
  const blockers=[];
  const gh=clean(githubMainSha),vercel=clean(vercelProductionSha),runtime=clean(runtimeSha);
  if(!sha256(gh)) blockers.push('GITHUB_MAIN_SHA_INVALID');
  if(!sha256(vercel)) blockers.push('VERCEL_PRODUCTION_SHA_INVALID');
  if(!sha256(runtime)) blockers.push('RUNTIME_SHA_INVALID');
  if(gh&&vercel&&gh!==vercel) blockers.push('GITHUB_VERCEL_SHA_MISMATCH');
  if(gh&&runtime&&gh!==runtime) blockers.push('GITHUB_RUNTIME_SHA_MISMATCH');
  for(const [key,ok] of Object.entries({productionDeploymentReady,browserSmokeVerified,apiSmokeVerified,realVideoSmokeVerified,rollbackTested,canaryCompleted,releaseEvidenceBundleVerified,releaseControllerApproved})){
    if(ok!==true) blockers.push(`PRODUCTION_CLOSURE_REQUIRED:${key}`);
  }
  return gate('EXACT_PRODUCTION_CLOSURE',blockers.length===0,blockers,{githubMainSha:gh||null,vercelProductionSha:vercel||null,runtimeSha:runtime||null});
}

export function evaluateFinalVideoCommercialClosure(input={}){
  const layers=freeze([
    verifyRealProviderLaunchClosure(input.realProviderLaunch),
    verifyPaidBetaClosure(input.paidBeta),
    verifyRealBenchmarkLoadClosure(input.benchmarkLoad),
    verifyExactProductionClosure(input.production),
  ]);
  const passed=layers.filter(layer=>layer.ok).length;
  const blockers=freeze(layers.flatMap(layer=>layer.blockers.map(item=>`${layer.id}:${item}`)));
  const paidBetaSaleReady=layers[0].ok&&layers[1].ok;
  const commercialGAReady=passed===layers.length;
  return freeze({
    ok:commercialGAReady,
    passedLayers:passed,
    totalLayers:layers.length,
    paidBetaSaleReady,
    commercialGAReady,
    status:commercialGAReady?'COMMERCIAL_GA_SALE_READY':(paidBetaSaleReady?'PAID_BETA_SALE_READY':'SALE_BLOCKED'),
    truth:commercialGAReady?'FINAL_COMMERCIAL_GA_CLOSURE_VERIFIED':'FINAL_COMMERCIAL_GA_CLOSURE_REQUIRED',
    layers,
    blockers,
    automaticMergeAllowed:false,
    automaticProductionPromotionAllowed:false,
  });
}
