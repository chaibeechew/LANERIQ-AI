import { getImageMarketRuntimeReadiness } from '../lib/ai/image-market-runtime.js';

const readiness=getImageMarketRuntimeReadiness();
const summary={
  mode:readiness.mode,
  executionReady:readiness.executionReady,
  marketReady:readiness.marketReady,
  provider:readiness.provider,
  providerConfigured:readiness.providerConfigured,
  providerSafetyReady:readiness.providerSafetyReady,
  observerConfigured:readiness.observerConfigured,
  verifiedOutputCount:readiness.verifiedOutputCount,
  productionEvidenceId:readiness.productionEvidenceId,
  reliability:readiness.reliability,
  refundVerified:readiness.refundVerified,
  e2eEvidenceId:readiness.e2eEvidenceId,
  releaseEvidenceHash:readiness.releaseEvidenceHash,
  blockers:readiness.blockers,
};
console.log(JSON.stringify(summary,null,2));
if(!readiness.marketReady){
  console.error('AI_IMAGE_MARKET_RELEASE_BLOCKED: live commercial evidence is incomplete.');
  process.exit(1);
}
console.log('AI_IMAGE_MARKET_RELEASE_READY: all fail-closed commercial evidence gates passed.');
