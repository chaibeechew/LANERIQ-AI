const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const finite=value=>Number.isFinite(Number(value));
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const nonEmptyArray=value=>Array.isArray(value)&&value.length>0;

export const VIDEO_COMMERCIAL_GA_GATES=freeze({
  LIVE_PROVIDER:'LIVE_PROVIDER',
  REAL_OUTPUT_BENCHMARK:'REAL_OUTPUT_BENCHMARK',
  BILLING:'BILLING',
  RELIABILITY:'RELIABILITY',
  PRODUCTION_RELEASE:'PRODUCTION_RELEASE',
});

export const VIDEO_COMMERCIAL_GA_STATUS=freeze({
  CODE_READY:'CODE_READY',
  EVIDENCE_REQUIRED:'EVIDENCE_REQUIRED',
  PAID_BETA_ELIGIBLE:'PAID_BETA_ELIGIBLE',
  COMMERCIAL_GA_READY:'COMMERCIAL_GA_READY',
});

function result(id,ok,blockers=[],evidence={}){
  return freeze({id,ok,blockers:freeze([...blockers]),evidence:freeze({...evidence})});
}

export function verifyLiveProviderGate({
  providerConnected=false,
  productionCredentialVerified=false,
  capabilities=[],
  verifiedCapabilities=[],
  externalExecutionCount=0,
  providerSelfReportOnly=true,
}={}){
  const required=['text-to-video','image-to-video','video-to-video'];
  const caps=new Set((Array.isArray(capabilities)?capabilities:[]).map(v=>clean(v).toLowerCase()));
  const verified=new Set((Array.isArray(verifiedCapabilities)?verifiedCapabilities:[]).map(v=>clean(v).toLowerCase()));
  const blockers=[];
  if(!providerConnected) blockers.push('PROVIDER_NOT_CONNECTED');
  if(!productionCredentialVerified) blockers.push('PRODUCTION_CREDENTIAL_NOT_VERIFIED');
  for(const capability of required){
    if(!caps.has(capability)) blockers.push(`CAPABILITY_MISSING:${capability}`);
    if(!verified.has(capability)) blockers.push(`LIVE_CAPABILITY_UNVERIFIED:${capability}`);
  }
  if(Number(externalExecutionCount)<3) blockers.push('INSUFFICIENT_REAL_PROVIDER_EXECUTIONS');
  if(providerSelfReportOnly) blockers.push('INDEPENDENT_PROVIDER_EVIDENCE_REQUIRED');
  return result(VIDEO_COMMERCIAL_GA_GATES.LIVE_PROVIDER,blockers.length===0,blockers,{requiredCapabilities:required,externalExecutionCount:Number(externalExecutionCount)||0});
}

export function verifyRealOutputBenchmarkGate({
  sampleCount=0,
  categoryCount=0,
  independentObservationCount=0,
  acceptedRate=0,
  p95QualityScore=0,
  safetyPassRate=0,
  provenanceCoverage=0,
  artifactHashCoverage=0,
}={}){
  const blockers=[];
  if(Number(sampleCount)<100) blockers.push('BENCHMARK_SAMPLE_COUNT_LT_100');
  if(Number(categoryCount)<6) blockers.push('BENCHMARK_CATEGORY_COUNT_LT_6');
  if(Number(independentObservationCount)<Number(sampleCount)) blockers.push('INDEPENDENT_OBSERVATION_INCOMPLETE');
  if(Number(acceptedRate)<0.9) blockers.push('ACCEPTED_RATE_LT_90_PERCENT');
  if(Number(p95QualityScore)<85) blockers.push('P95_QUALITY_LT_85');
  if(Number(safetyPassRate)<0.995) blockers.push('SAFETY_PASS_RATE_LT_99_5_PERCENT');
  if(Number(provenanceCoverage)<1) blockers.push('PROVENANCE_COVERAGE_INCOMPLETE');
  if(Number(artifactHashCoverage)<1) blockers.push('ARTIFACT_HASH_COVERAGE_INCOMPLETE');
  return result(VIDEO_COMMERCIAL_GA_GATES.REAL_OUTPUT_BENCHMARK,blockers.length===0,blockers,{sampleCount:Number(sampleCount)||0,categoryCount:Number(categoryCount)||0});
}

export function verifyBillingGate({
  requestIdempotencyVerified=false,
  quoteBeforeDispatchVerified=false,
  chargeAfterDurableSuccess=false,
  failedJobNoChargeVerified=false,
  cancellationRefundVerified=false,
  duplicateChargeProtection=false,
  hardSpendCapVerified=false,
  ledgerReconciliationVerified=false,
}={}){
  const checks={requestIdempotencyVerified,quoteBeforeDispatchVerified,chargeAfterDurableSuccess,failedJobNoChargeVerified,cancellationRefundVerified,duplicateChargeProtection,hardSpendCapVerified,ledgerReconciliationVerified};
  const blockers=Object.entries(checks).filter(([,ok])=>ok!==true).map(([key])=>`BILLING_EVIDENCE_REQUIRED:${key}`);
  return result(VIDEO_COMMERCIAL_GA_GATES.BILLING,blockers.length===0,blockers,checks);
}

export function verifyReliabilityGate({
  completedJobs=0,
  successRate=0,
  timeoutRecoveryVerified=false,
  providerRetryVerified=false,
  idempotentReplayVerified=false,
  durableMp4Verified=false,
  reopenVerified=false,
  malwareScanVerified=false,
  p95QueueSeconds,
  p95CompletionMinutes,
}={}){
  const blockers=[];
  if(Number(completedJobs)<100) blockers.push('RELIABILITY_SAMPLE_COUNT_LT_100');
  if(Number(successRate)<0.95) blockers.push('SUCCESS_RATE_LT_95_PERCENT');
  for(const [key,ok] of Object.entries({timeoutRecoveryVerified,providerRetryVerified,idempotentReplayVerified,durableMp4Verified,reopenVerified,malwareScanVerified})){
    if(ok!==true) blockers.push(`RELIABILITY_EVIDENCE_REQUIRED:${key}`);
  }
  if(!finite(p95QueueSeconds)) blockers.push('P95_QUEUE_LATENCY_REQUIRED');
  if(!finite(p95CompletionMinutes)) blockers.push('P95_COMPLETION_LATENCY_REQUIRED');
  return result(VIDEO_COMMERCIAL_GA_GATES.RELIABILITY,blockers.length===0,blockers,{completedJobs:Number(completedJobs)||0,successRate:Number(successRate)||0,p95QueueSeconds:finite(p95QueueSeconds)?Number(p95QueueSeconds):null,p95CompletionMinutes:finite(p95CompletionMinutes)?Number(p95CompletionMinutes):null});
}

export function verifyProductionReleaseGate({
  githubMainSha='',
  vercelProductionSha='',
  runtimeVerifiedSha='',
  productionDeploymentReady=false,
  browserSmokeVerified=false,
  apiSmokeVerified=false,
  rollbackVerified=false,
  releaseEvidenceIds=[],
}={}){
  const blockers=[];
  const github=clean(githubMainSha),vercel=clean(vercelProductionSha),runtime=clean(runtimeVerifiedSha);
  if(!sha256(github)) blockers.push('GITHUB_MAIN_SHA_INVALID');
  if(!sha256(vercel)) blockers.push('VERCEL_PRODUCTION_SHA_INVALID');
  if(!sha256(runtime)) blockers.push('RUNTIME_SHA_INVALID');
  if(github&&vercel&&github!==vercel) blockers.push('GITHUB_VERCEL_SHA_MISMATCH');
  if(github&&runtime&&github!==runtime) blockers.push('GITHUB_RUNTIME_SHA_MISMATCH');
  if(productionDeploymentReady!==true) blockers.push('PRODUCTION_DEPLOYMENT_NOT_READY');
  if(browserSmokeVerified!==true) blockers.push('PRODUCTION_BROWSER_SMOKE_REQUIRED');
  if(apiSmokeVerified!==true) blockers.push('PRODUCTION_API_SMOKE_REQUIRED');
  if(rollbackVerified!==true) blockers.push('ROLLBACK_EVIDENCE_REQUIRED');
  if(!nonEmptyArray(releaseEvidenceIds)) blockers.push('RELEASE_EVIDENCE_IDS_REQUIRED');
  return result(VIDEO_COMMERCIAL_GA_GATES.PRODUCTION_RELEASE,blockers.length===0,blockers,{githubMainSha:github||null,vercelProductionSha:vercel||null,runtimeVerifiedSha:runtime||null});
}

export function evaluateVideoCommercialGA(input={}){
  const gates=freeze([
    verifyLiveProviderGate(input.liveProvider),
    verifyRealOutputBenchmarkGate(input.benchmark),
    verifyBillingGate(input.billing),
    verifyReliabilityGate(input.reliability),
    verifyProductionReleaseGate(input.productionRelease),
  ]);
  const blockers=freeze(gates.flatMap(gate=>gate.blockers.map(blocker=>`${gate.id}:${blocker}`)));
  const passed=gates.filter(g=>g.ok).length;
  const paidBetaEligible=gates[0].ok&&gates[2].ok&&gates[3].ok;
  const commercialGAReady=passed===gates.length;
  return freeze({
    ok:commercialGAReady,
    paidBetaEligible,
    commercialGAReady,
    status:commercialGAReady?VIDEO_COMMERCIAL_GA_STATUS.COMMERCIAL_GA_READY:(paidBetaEligible?VIDEO_COMMERCIAL_GA_STATUS.PAID_BETA_ELIGIBLE:VIDEO_COMMERCIAL_GA_STATUS.EVIDENCE_REQUIRED),
    passedGates:passed,
    totalGates:gates.length,
    gates,
    blockers,
    truth:commercialGAReady?'COMMERCIAL_GA_VERIFIED':'COMMERCIAL_GA_NOT_VERIFIED',
  });
}
