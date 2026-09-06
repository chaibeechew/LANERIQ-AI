import { evaluateStaticStorePackage } from './store-static-gate.mjs';
import { evaluateFiveLayerReadiness } from './release-readiness.mjs';
import { trustedReleaseEvidenceKeyCount } from './release-evidence-attestation.mjs';
import { loadVerifiedReleaseEvidenceBundle } from './release-evidence-bundle.mjs';

export function buildLaunchReport({ root = process.cwd(), evidence = null, nowMs = Date.now() } = {}) {
  const staticGate = evaluateStaticStorePackage(root);
  const bundle = evidence == null
    ? loadVerifiedReleaseEvidenceBundle({ nowMs })
    : Object.freeze({ evidence, verifiedGateIds: [], rejectedGateIds: [], totalTokens: 0 });

  const fiveLayer = evaluateFiveLayerReadiness({
    androidTargetApi36: staticGate.checks.compileSdk36 && staticGate.checks.targetSdk36,
    productionApplicationId: staticGate.checks.productionApplicationId,
    ...bundle.evidence,
  });

  return Object.freeze({
    product: 'LANERIQ Anti Scam',
    staticStorePackage: staticGate.readyForExternalEvidenceCollection ? 'READY' : 'BLOCKED',
    trustedReleaseEvidenceKeyCount: trustedReleaseEvidenceKeyCount(),
    evidenceBundle: Object.freeze({
      totalTokens: bundle.totalTokens,
      verifiedGateIds: bundle.verifiedGateIds,
      rejectedGateIds: bundle.rejectedGateIds,
    }),
    publicProduction: fiveLayer.publicProduction.state,
    blockedLayers: fiveLayer.publicProduction.blockedLayers,
    layers: fiveLayer.layers,
    truth: fiveLayer.publicProduction.ready
      ? 'All five launch layers have verified evidence.'
      : 'Public Production remains blocked until every applicable external gate is represented by trusted signed evidence for the exact shipping artifact.',
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildLaunchReport(), null, 2));
}
