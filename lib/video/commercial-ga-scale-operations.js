const freeze=v=>Object.freeze(v);
const num=v=>Number(v);

export function verifyVideoSLO({availability=0,successRate=0,p95QueueSeconds,p95CompletionMinutes,errorBudgetBurn=1}={}){
  const blockers=[];
  if(num(availability)<0.995) blockers.push('AVAILABILITY_LT_99_5_PERCENT');
  if(num(successRate)<0.97) blockers.push('SUCCESS_RATE_LT_97_PERCENT');
  if(!Number.isFinite(num(p95QueueSeconds))||num(p95QueueSeconds)>30) blockers.push('P95_QUEUE_GT_30_SECONDS');
  if(!Number.isFinite(num(p95CompletionMinutes))||num(p95CompletionMinutes)>8) blockers.push('P95_COMPLETION_GT_8_MINUTES');
  if(num(errorBudgetBurn)>1) blockers.push('ERROR_BUDGET_EXHAUSTED');
  return freeze({ok:blockers.length===0,blockers:freeze(blockers)});
}

export function verifyCapacityAndBackpressure({concurrencyLimit=0,observedPeakConcurrency=0,queueDepth=0,maxQueueDepth=0,admissionControlVerified=false,backpressureVerified=false,loadSheddingVerified=false}={}){
  const blockers=[];
  if(num(concurrencyLimit)<=0) blockers.push('CONCURRENCY_LIMIT_REQUIRED');
  if(num(observedPeakConcurrency)>num(concurrencyLimit)) blockers.push('PEAK_CONCURRENCY_EXCEEDED');
  if(num(maxQueueDepth)<=0) blockers.push('MAX_QUEUE_DEPTH_REQUIRED');
  if(num(queueDepth)>num(maxQueueDepth)) blockers.push('QUEUE_DEPTH_EXCEEDED');
  if(admissionControlVerified!==true) blockers.push('ADMISSION_CONTROL_REQUIRED');
  if(backpressureVerified!==true) blockers.push('BACKPRESSURE_REQUIRED');
  if(loadSheddingVerified!==true) blockers.push('LOAD_SHEDDING_REQUIRED');
  return freeze({ok:blockers.length===0,blockers:freeze(blockers)});
}

export function verifyVideoUnitEconomics({averageProviderCost=0,averageRevenue=0,p95ProviderCost=0,maxAllowedProviderCost=0,refundReserveRatio=0,grossMarginFloor=0.25}={}){
  const blockers=[];
  const cost=num(averageProviderCost),revenue=num(averageRevenue);
  const margin=revenue>0?(revenue-cost)/revenue:-1;
  if(revenue<=0) blockers.push('AVERAGE_REVENUE_REQUIRED');
  if(cost<0) blockers.push('AVERAGE_PROVIDER_COST_INVALID');
  if(num(maxAllowedProviderCost)<=0) blockers.push('MAX_PROVIDER_COST_REQUIRED');
  if(num(p95ProviderCost)>num(maxAllowedProviderCost)) blockers.push('P95_PROVIDER_COST_EXCEEDS_CAP');
  if(margin<num(grossMarginFloor)) blockers.push('GROSS_MARGIN_BELOW_FLOOR');
  if(num(refundReserveRatio)<0.02) blockers.push('REFUND_RESERVE_LT_2_PERCENT');
  return freeze({ok:blockers.length===0,grossMargin:margin,blockers:freeze(blockers)});
}

export function classifyVideoIncident({safetyBreach=false,billingCorruption=false,dataIntegrityLoss=false,providerOutage=false,errorRate=0,latencyMultiplier=1}={}){
  if(safetyBreach||billingCorruption||dataIntegrityLoss) return 'SEV0';
  if(providerOutage||num(errorRate)>=0.2) return 'SEV1';
  if(num(errorRate)>=0.08||num(latencyMultiplier)>=3) return 'SEV2';
  if(num(errorRate)>=0.03||num(latencyMultiplier)>=1.5) return 'SEV3';
  return 'NORMAL';
}

export function buildVideoAutoDegradePlan({severity='NORMAL',premiumFallbackAllowed=false}={}){
  const sev=String(severity||'NORMAL').toUpperCase();
  const map={
    NORMAL:{acceptNewJobs:true,degradeQuality:false,pausePaidDispatch:false,rollback:false},
    SEV3:{acceptNewJobs:true,degradeQuality:true,pausePaidDispatch:false,rollback:false},
    SEV2:{acceptNewJobs:true,degradeQuality:true,pausePaidDispatch:!premiumFallbackAllowed,rollback:false},
    SEV1:{acceptNewJobs:false,degradeQuality:true,pausePaidDispatch:true,rollback:true},
    SEV0:{acceptNewJobs:false,degradeQuality:true,pausePaidDispatch:true,rollback:true},
  };
  const plan=map[sev]||map.SEV0;
  return freeze({...plan,severity:sev,automaticFullRolloutAllowed:false});
}

export function evaluateVideoScaleReadiness(input={}){
  const slo=verifyVideoSLO(input.slo);
  const capacity=verifyCapacityAndBackpressure(input.capacity);
  const economics=verifyVideoUnitEconomics(input.economics);
  const blockers=[...slo.blockers,...capacity.blockers,...economics.blockers];
  return freeze({ok:blockers.length===0,slo,capacity,economics,blockers:freeze(blockers),truth:blockers.length===0?'SCALE_OPERATIONS_VERIFIED':'SCALE_OPERATIONS_EVIDENCE_REQUIRED'});
}
