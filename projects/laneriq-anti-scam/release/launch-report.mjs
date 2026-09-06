import { evaluateStaticStorePackage } from './store-static-gate.mjs';
import { evaluateFiveLayerReadiness } from './release-readiness.mjs';
import { trustedReleaseEvidenceKeyCount } from './release-evidence-attestation.mjs';
import { loadVerifiedReleaseEvidenceBundle } from './release-evidence-bundle.mjs';
import { computeReleaseSourceDigest } from './release-source-digest.mjs';

export function buildLaunchReport({ root = process.cwd(), evidence = null, nowMs = Date.now() } = {}) {
  const staticGate = evaluateStaticStorePackage(root);
  const sourceDigest = computeReleaseSourceDigest({ root });
  const bundle = evidence == null
    ? loadVerifiedReleaseEvidenceBundle({ nowMs, root, releaseSourceDigest: sourceDigest })
    : Object.freeze({
        evidence,
        verifiedGateIds: [],
        rejectedGateIds: [],
        totalTokens: 0,
        releaseSourceDigestSha256: sourceDigest.sha256,
        releaseSourceFileCount: sourceDigest.fileCount,
      });

  const fiveLayer = evaluateFiveLayerReadiness({
    androidTargetApi36: staticGate.checks.compileSdk36 && staticGate.checks.targetSdk36,
    productionApplicationId: staticGate.checks.productionApplicationId,
    ...bundle.evidence,
  });

  return Object.freeze({
    product: 'LANERIQ Anti Scam',
    releaseSourceDigestSha256: sourceDigest.sha256,
    releaseSourceFileCount: sourceDigest.fileCount,
    staticStorePackage: staticGate.readyForExternalEvidenceCollection ? 'READY' : 'BLOCKED',
    staticStoreFailures: Object.freeze(staticGate.failures || []),
    trustedReleaseEvidenceKeyCount: trustedReleaseEvidenceKeyCount(),
    evidenceBundle: Object.freeze({
      totalTokens: bundle.totalTokens,
      verifiedGateIds: bundle.verifiedGateIds,
      rejectedGateIds: bundle.rejectedGateIds,
      releaseSourceDigestSha256: bundle.releaseSourceDigestSha256,
    }),
    publicProduction: fiveLayer.publicProduction.state,
    blockedLayers: fiveLayer.publicProduction.blockedLayers,
    layers: fiveLayer.layers,
    truth: fiveLayer.publicProduction.ready
      ? 'All five launch layers have verified evidence bound to the current deterministic release-source digest.'
      : 'Public Production remains blocked until every applicable external gate is represented by trusted signed evidence bound to the current release-source digest and exact shipping artifact/runtime evidence where required.',
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildLaunchReport(), null, 2));
}
