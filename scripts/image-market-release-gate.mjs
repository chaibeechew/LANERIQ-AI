import {getImageMarketRuntimeReadiness} from '../lib/ai/image-market-runtime.js';

const readiness=getImageMarketRuntimeReadiness();
const summary={
  marketReady:readiness.marketReady,
  decision:readiness.decision,
  truth:readiness.truth,
  evidenceBundleVerified:readiness.evidenceBundleVerified,
  evidenceBundleSha256:readiness.evidenceBundleSha256,
  providerConfigured:readiness.providerConfigured,
  providerSafetyReady:readiness.providerSafetyReady,
  observerConfigured:readiness.observerConfigured,
  passedLayers:readiness.passedLayers,
  totalLayers:readiness.totalLayers,
  evidence:readiness.evidence,
  reliability:readiness.reliability,
  release:readiness.release,
  blockers:readiness.blockers,
};
console.log(JSON.stringify(summary,null,2));
if(!readiness.marketReady){
  console.error('AI_IMAGE_MARKET_RELEASE_BLOCKED: signed live commercial evidence is incomplete or does not match the exact Production main SHA.');
  process.exit(1);
}
console.log('AI_IMAGE_MARKET_RELEASE_READY: all four fail-closed commercial evidence layers passed with a signed evidence bundle and exact Production main SHA.');
