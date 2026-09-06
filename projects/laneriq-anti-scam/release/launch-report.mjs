import { evaluateStaticStorePackage } from './store-static-gate.mjs';
import { evaluateFiveLayerReadiness } from './release-readiness.mjs';
import { trustedReleaseEvidenceKeyCount } from './release-evidence-attestation.mjs';

export function buildLaunchReport({ root = process.cwd(), evidence = {} } = {}) {
  const staticGate = evaluateStaticStorePackage(root);
  const fiveLayer = evaluateFiveLayerReadiness({
    androidTargetApi36: staticGate.checks.compileSdk36 && staticGate.checks.targetSdk36,
    productionApplicationId: staticGate.checks.productionApplicationId,
    ...evidence,
  });

  return Object.freeze({
    product: 'LANERIQ Anti Scam',
    staticStorePackage: staticGate.readyForExternalEvidenceCollection ? 'READY' : 'BLOCKED',
    trustedReleaseEvidenceKeyCount: trustedReleaseEvidenceKeyCount(),
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
