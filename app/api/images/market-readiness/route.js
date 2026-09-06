import {NextResponse} from 'next/server';
import {getImageMarketRuntimeReadiness} from '../../../../lib/ai/image-market-runtime.js';

function noStore(payload,status=200){
  return NextResponse.json(payload,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
}

export async function GET(){
  const readiness=getImageMarketRuntimeReadiness();
  return noStore({
    ok:true,
    marketReady:readiness.marketReady,
    decision:readiness.decision,
    truth:readiness.truth,
    evidenceBundleVerified:readiness.evidenceBundleVerified,
    evidenceBundleSha256:readiness.evidenceBundleSha256,
    providerConfigured:readiness.providerConfigured,
    providerSafetyReady:readiness.providerSafetyReady,
    observerConfigured:readiness.observerConfigured,
    observerKind:readiness.observerKind,
    passedLayers:readiness.passedLayers,
    totalLayers:readiness.totalLayers,
    layers:readiness.layers,
    evidence:readiness.evidence,
    reliability:readiness.reliability,
    release:readiness.release,
    blockers:readiness.blockers,
    rule:readiness.rule,
  });
}
