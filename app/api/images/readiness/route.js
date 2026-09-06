import { NextResponse } from "next/server";
import { getImageGenerationConfig } from "../../../../lib/ai/image-generation-gateway.js";
import { getImageProductionHardenedConfig } from "../../../../lib/ai/image-production-hardened-runtime.js";

export async function GET(){
  const config=getImageGenerationConfig();
  const hardened=getImageProductionHardenedConfig();
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
    marketSalesReady:false,
    truth:"EVIDENCE_REQUIRED",
  },{headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
}
