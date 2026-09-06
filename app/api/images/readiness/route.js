import { NextResponse } from "next/server";
import { getImageGenerationConfig } from "../../../../lib/ai/image-generation-gateway.js";
import { getImageProductionHardenedConfig } from "../../../../lib/ai/image-production-hardened-runtime.js";
import { getImageMarketRuntimeReadiness } from "../../../../lib/ai/image-market-runtime.js";

export async function GET(){
  const config=getImageGenerationConfig();
  const hardened=getImageProductionHardenedConfig();
  const market=getImageMarketRuntimeReadiness();
  return NextResponse.json({
    ok:true,
    externalProviderConnected:config.connected,
    externalProviderAllowed:config.configured,
    blockedByCostPolicy:config.blockedByCostPolicy,
    costMode:config.costMode,
    durableProviderCapture:true,
    idempotentReplay:true,
    maxProviderOutputs:4,
    hardenedExecutionWired:true,
    failClosedQualityGate:true,
    independentObserverRequired:true,
    independentObserverConfigured:hardened.observerConnected,
    providerSafetyReady:hardened.safetyReady,
    serverByteCapture:true,
    observerByteHashBinding:true,
    minimumAcceptedQualityScore:88,
    liveProviderEvidenceRequired:true,
    signedMarketEvidenceRequired:true,
    evidenceBundleVerified:market.evidenceBundleVerified,
    passedMarketLayers:market.passedLayers,
    totalMarketLayers:market.totalLayers,
    marketSalesReady:market.marketReady,
    marketDecision:market.decision,
    marketBlockers:market.blockers,
    truth:market.truth,
  },{headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
}
