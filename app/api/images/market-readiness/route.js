import { NextResponse } from 'next/server';
import { getImageMarketRuntimeReadiness } from '../../../../lib/ai/image-market-runtime.js';

export async function GET(){
  const readiness=getImageMarketRuntimeReadiness();
  return NextResponse.json({
    ok:true,
    marketReady:readiness.marketReady,
    executionReady:readiness.executionReady,
    mode:readiness.mode,
    provider:readiness.provider,
    providerConfigured:readiness.providerConfigured,
    providerSafetyReady:readiness.providerSafetyReady,
    capabilityReady:readiness.capabilityReady,
    observerConfigured:readiness.observerConfigured,
    observerKind:readiness.observerKind,
    verifiedOutputCount:readiness.verifiedOutputCount,
    verifiedQualityScore:readiness.verifiedQualityScore,
    minimumVerifiedOutputs:readiness.minimumVerifiedOutputs,
    minimumVerifiedQualityScore:readiness.minimumVerifiedQualityScore,
    productionEvidenceId:readiness.productionEvidenceId,
    reliability:readiness.reliability,
    refundVerified:readiness.refundVerified,
    e2eEvidenceId:readiness.e2eEvidenceId,
    releaseEvidenceHash:readiness.releaseEvidenceHash,
    release:readiness.release,
    blockers:readiness.blockers,
    rule:readiness.rule,
  },{headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
}
