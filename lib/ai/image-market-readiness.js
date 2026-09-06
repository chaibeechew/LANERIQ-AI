const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const num=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};

export const AI_IMAGE_MARKET_LAYERS=freeze([
  'production-runtime-wiring',
  'real-provider-output-proof',
  'commercial-reliability-gate',
  'market-release-gate',
]);

export const AI_IMAGE_MARKET_POLICY=freeze({
  minVerifiedOutputs:20,
  minQualityScore:88,
  minSuccessRate:0.98,
  maxP95LatencyMs:45000,
  maxRefundFailureRate:0,
  requireSafety:true,
  requireProvenance:true,
  requireDurableCapture:true,
  requireExactSha:true,
  requireAuthenticatedProductionE2E:true,
  requireMonitoring:true,
});

export function assessAiImageMarketReadiness(input={}){
  const runtime=input.runtime||{};
  const evidence=input.evidence||{};
  const reliability=input.reliability||{};
  const release=input.release||{};
  const layers=[];

  layers.push(freeze({
    id:AI_IMAGE_MARKET_LAYERS[0],
    passed:runtime.hardenedExecutionWired===true&&runtime.failClosedQualityGate===true&&runtime.creditsAtomic===true&&runtime.durableCapture===true,
    checks:freeze({hardenedExecutionWired:runtime.hardenedExecutionWired===true,failClosedQualityGate:runtime.failClosedQualityGate===true,creditsAtomic:runtime.creditsAtomic===true,durableCapture:runtime.durableCapture===true}),
  }));

  layers.push(freeze({
    id:AI_IMAGE_MARKET_LAYERS[1],
    passed:evidence.liveProviderVerified===true&&num(evidence.verifiedOutputCount)>=AI_IMAGE_MARKET_POLICY.minVerifiedOutputs&&num(evidence.qualityScore)>=AI_IMAGE_MARKET_POLICY.minQualityScore&&evidence.safetyPassed===true&&evidence.provenanceVerified===true&&evidence.outputValidated===true,
    checks:freeze({liveProviderVerified:evidence.liveProviderVerified===true,verifiedOutputCount:num(evidence.verifiedOutputCount),qualityScore:num(evidence.qualityScore),safetyPassed:evidence.safetyPassed===true,provenanceVerified:evidence.provenanceVerified===true,outputValidated:evidence.outputValidated===true}),
  }));

  layers.push(freeze({
    id:AI_IMAGE_MARKET_LAYERS[2],
    passed:num(reliability.successRate)>=AI_IMAGE_MARKET_POLICY.minSuccessRate&&num(reliability.p95LatencyMs,Infinity)<=AI_IMAGE_MARKET_POLICY.maxP95LatencyMs&&num(reliability.refundFailureRate,Infinity)<=AI_IMAGE_MARKET_POLICY.maxRefundFailureRate&&reliability.idempotencyVerified===true&&reliability.providerFailoverVerified===true&&reliability.rateLimitVerified===true,
    checks:freeze({successRate:num(reliability.successRate),p95LatencyMs:num(reliability.p95LatencyMs,Infinity),refundFailureRate:num(reliability.refundFailureRate,Infinity),idempotencyVerified:reliability.idempotencyVerified===true,providerFailoverVerified:reliability.providerFailoverVerified===true,rateLimitVerified:reliability.rateLimitVerified===true}),
  }));

  layers.push(freeze({
    id:AI_IMAGE_MARKET_LAYERS[3],
    passed:release.authenticatedProductionE2E===true&&release.browserVerified===true&&release.mobileVerified===true&&release.abuseSuitePassed===true&&release.monitoringReady===true&&release.mainSha&&release.productionSha&&clean(release.mainSha)===clean(release.productionSha),
    checks:freeze({authenticatedProductionE2E:release.authenticatedProductionE2E===true,browserVerified:release.browserVerified===true,mobileVerified:release.mobileVerified===true,abuseSuitePassed:release.abuseSuitePassed===true,monitoringReady:release.monitoringReady===true,exactSha:Boolean(release.mainSha&&release.productionSha&&clean(release.mainSha)===clean(release.productionSha))}),
  }));

  const passedLayers=layers.filter(layer=>layer.passed).length;
  const marketReady=passedLayers===AI_IMAGE_MARKET_LAYERS.length;
  return freeze({
    marketReady,
    decision:marketReady?'MARKET_SALES_READY':'HOLD',
    passedLayers,
    totalLayers:AI_IMAGE_MARKET_LAYERS.length,
    layers:freeze(layers),
    truth:marketReady?'PRODUCTION_LIVE_VERIFIED':'EVIDENCE_REQUIRED',
    rule:'AI Image may be sold as live provider-backed generation only when all four commercial gates pass with real Production evidence. Code readiness or simulated evidence can never close a live gate.',
  });
}
