const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const num=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
const HEX40=/^[a-f0-9]{40}$/i;
const HEX64=/^[a-f0-9]{64}$/i;

export const AI_IMAGE_MARKET_LAYERS=freeze([
  'production-runtime-wiring',
  'real-provider-output-proof',
  'commercial-reliability-gate',
  'market-release-gate',
]);

export const AI_IMAGE_MARKET_POLICY=freeze({
  minVerifiedOutputs:20,
  minQualityScore:88,
  minReliabilitySamples:100,
  minSuccessRate:0.98,
  maxP95LatencyMs:45000,
  maxRefundFailureRate:0,
  requireSafety:true,
  requireProvenance:true,
  requireDurableCapture:true,
  requireSignedObserver:true,
  requireArtifactHashBinding:true,
  rejectProviderSelfReport:true,
  requireEvidenceHashes:true,
  requireExactSha:true,
  requireAuthenticatedProductionE2E:true,
  requireMonitoring:true,
  requireReleaseApproval:true,
});

function bool(value){return value===true;}
function hash64(value){return HEX64.test(clean(value));}
function sha40(value){return HEX40.test(clean(value));}

export function assessAiImageMarketReadiness(input={}){
  const runtime=input.runtime||{};
  const evidence=input.evidence||{};
  const reliability=input.reliability||{};
  const release=input.release||{};
  const layers=[];

  const layer1=freeze({
    id:AI_IMAGE_MARKET_LAYERS[0],
    passed:bool(runtime.hardenedExecutionWired)&&bool(runtime.failClosedQualityGate)&&bool(runtime.creditsAtomic)&&bool(runtime.durableCapture),
    checks:freeze({
      hardenedExecutionWired:bool(runtime.hardenedExecutionWired),
      failClosedQualityGate:bool(runtime.failClosedQualityGate),
      creditsAtomic:bool(runtime.creditsAtomic),
      durableCapture:bool(runtime.durableCapture),
    }),
  });
  layers.push(layer1);

  const layer2=freeze({
    id:AI_IMAGE_MARKET_LAYERS[1],
    passed:bool(evidence.liveProviderVerified)
      &&num(evidence.verifiedOutputCount)>=AI_IMAGE_MARKET_POLICY.minVerifiedOutputs
      &&num(evidence.qualityScore)>=AI_IMAGE_MARKET_POLICY.minQualityScore
      &&Boolean(clean(evidence.productionEvidenceId))
      &&hash64(evidence.evidenceSha256)
      &&bool(evidence.safetyPassed)
      &&bool(evidence.provenanceVerified)
      &&bool(evidence.outputValidated)
      &&bool(evidence.observerSignedEvidence)
      &&bool(evidence.artifactHashBound)
      &&evidence.providerSelfReported===false,
    checks:freeze({
      liveProviderVerified:bool(evidence.liveProviderVerified),
      verifiedOutputCount:num(evidence.verifiedOutputCount),
      qualityScore:num(evidence.qualityScore),
      productionEvidenceId:Boolean(clean(evidence.productionEvidenceId)),
      evidenceSha256:hash64(evidence.evidenceSha256),
      safetyPassed:bool(evidence.safetyPassed),
      provenanceVerified:bool(evidence.provenanceVerified),
      outputValidated:bool(evidence.outputValidated),
      observerSignedEvidence:bool(evidence.observerSignedEvidence),
      artifactHashBound:bool(evidence.artifactHashBound),
      providerSelfReported:evidence.providerSelfReported===true,
    }),
  });
  layers.push(layer2);

  const alternateProviderAvailable=bool(reliability.alternateProviderAvailable);
  const failoverSatisfied=!alternateProviderAvailable||bool(reliability.providerFailoverVerified);
  const p95LatencyMs=num(reliability.p95LatencyMs,Infinity);
  const refundFailureRate=num(reliability.refundFailureRate,Infinity);
  const layer3=freeze({
    id:AI_IMAGE_MARKET_LAYERS[2],
    passed:num(reliability.sampleSize)>=AI_IMAGE_MARKET_POLICY.minReliabilitySamples
      &&num(reliability.successRate)>=AI_IMAGE_MARKET_POLICY.minSuccessRate
      &&p95LatencyMs>0&&p95LatencyMs<=AI_IMAGE_MARKET_POLICY.maxP95LatencyMs
      &&refundFailureRate===AI_IMAGE_MARKET_POLICY.maxRefundFailureRate
      &&hash64(reliability.evidenceSha256)
      &&bool(reliability.refundVerified)
      &&bool(reliability.idempotencyVerified)
      &&bool(reliability.rateLimitVerified)
      &&bool(reliability.abusePressureVerified)
      &&failoverSatisfied,
    checks:freeze({
      sampleSize:num(reliability.sampleSize),
      successRate:num(reliability.successRate),
      p95LatencyMs,
      refundFailureRate,
      evidenceSha256:hash64(reliability.evidenceSha256),
      refundVerified:bool(reliability.refundVerified),
      idempotencyVerified:bool(reliability.idempotencyVerified),
      rateLimitVerified:bool(reliability.rateLimitVerified),
      abusePressureVerified:bool(reliability.abusePressureVerified),
      alternateProviderAvailable,
      providerFailoverVerified:bool(reliability.providerFailoverVerified),
      failoverSatisfied,
    }),
  });
  layers.push(layer3);

  const mainSha=clean(release.mainSha).toLowerCase();
  const productionSha=clean(release.productionSha).toLowerCase();
  const exactSha=sha40(mainSha)&&sha40(productionSha)&&mainSha===productionSha;
  const layer4=freeze({
    id:AI_IMAGE_MARKET_LAYERS[3],
    passed:bool(release.authenticatedProductionE2E)
      &&Boolean(clean(release.e2eEvidenceId))
      &&hash64(release.releaseEvidenceSha256)
      &&bool(release.browserVerified)
      &&bool(release.mobileVerified)
      &&bool(release.abuseSuitePassed)
      &&bool(release.monitoringReady)
      &&bool(release.productionTarget)
      &&bool(release.releaseApproved)
      &&exactSha,
    checks:freeze({
      authenticatedProductionE2E:bool(release.authenticatedProductionE2E),
      e2eEvidenceId:Boolean(clean(release.e2eEvidenceId)),
      releaseEvidenceSha256:hash64(release.releaseEvidenceSha256),
      browserVerified:bool(release.browserVerified),
      mobileVerified:bool(release.mobileVerified),
      abuseSuitePassed:bool(release.abuseSuitePassed),
      monitoringReady:bool(release.monitoringReady),
      productionTarget:bool(release.productionTarget),
      releaseApproved:bool(release.releaseApproved),
      exactSha,
    }),
  });
  layers.push(layer4);

  const passedLayers=layers.filter(layer=>layer.passed).length;
  const marketReady=passedLayers===AI_IMAGE_MARKET_LAYERS.length;
  const blockers=[];
  if(!layer1.passed)blockers.push('production-runtime-wiring-incomplete');
  if(!layer2.passed)blockers.push('real-provider-output-proof-incomplete');
  if(!layer3.passed)blockers.push('commercial-reliability-proof-incomplete');
  if(!layer4.passed)blockers.push('market-release-proof-incomplete');

  return freeze({
    marketReady,
    decision:marketReady?'MARKET_SALES_READY':'HOLD',
    passedLayers,
    totalLayers:AI_IMAGE_MARKET_LAYERS.length,
    layers:freeze(layers),
    blockers:freeze(blockers),
    truth:marketReady?'PRODUCTION_LIVE_VERIFIED':'EVIDENCE_REQUIRED',
    rule:'AI Image may be sold as live provider-backed generation only when all four commercial gates pass with real Production evidence. Layer 2 requires signed independent observer evidence bound to captured bytes; Layer 3 requires >=100 measured commercial samples; Layer 4 requires authenticated Production E2E, evidence hashes, real mobile/browser/monitoring proof, explicit approval and exact 40-character main=Production SHA. Code readiness, configured environment variables or provider self-report can never close a live gate.',
  });
}
