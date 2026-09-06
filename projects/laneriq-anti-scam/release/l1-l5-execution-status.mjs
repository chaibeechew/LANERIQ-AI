import fs from 'node:fs';
import path from 'node:path';
import { evaluateStaticStorePackage } from './store-static-gate.mjs';
import { buildLaunchReport } from './launch-report.mjs';

const State = Object.freeze({
  CODE_IMPLEMENTED: 'CODE_IMPLEMENTED',
  DEPLOYMENT_READY: 'DEPLOYMENT_READY',
  EXTERNAL_EVIDENCE_REQUIRED: 'EXTERNAL_EVIDENCE_REQUIRED',
  PRODUCTION_READY: 'PRODUCTION_READY',
  BLOCKED: 'BLOCKED',
});

function file(root, relative) {
  return fs.existsSync(path.join(root, 'projects/laneriq-anti-scam', relative));
}

export function buildL1L5ExecutionStatus({ root = process.cwd(), evidence = {} } = {}) {
  const staticGate = evaluateStaticStorePackage(root);
  const launch = buildLaunchReport({ root, evidence });

  const l1Code = staticGate.checks.l1VpnServicePlatformProtected
    && staticGate.checks.l1VpnConsentRequired
    && staticGate.checks.l1FakeTunnelForbidden
    && staticGate.checks.signedReputationCryptoPathPresent;
  const l2Code = staticGate.checks.l2SharedMalwareBrokerHashBound
    && file(root, 'cloud/lib/selected-file-scan-handler.mjs');
  const l3Code = staticGate.checks.l3RealDeviceHarnessPresent
    && file(root, 'fabric/app-builder-witness-consumer.mjs');
  const l4Code = staticGate.checks.l4AttestationAndWitnessRequired
    && staticGate.checks.l4PrivateHeartbeatFieldsRejected
    && staticGate.checks.l4DeadmanRlsAndReplayProtection
    && file(root, 'cloud/lib/supabase-deadman-store.mjs')
    && file(root, '../../.github/workflows/laneriq-anti-scam-cloud-deadman-deploy.yml');
  const l5Code = file(root, '../../.github/workflows/laneriq-anti-scam-production-aab.yml')
    && file(root, '../../.github/workflows/laneriq-anti-scam-final-store-release-gate.yml')
    && file(root, 'release/PUBLIC_RELEASE_EVIDENCE.json');

  const code = [l1Code, l2Code, l3Code, l4Code, l5Code];
  const launchLayers = launch.layers || [];
  const layers = code.map((implemented, index) => {
    const id = `L${index + 1}`;
    const evidenceLayer = launchLayers[index];
    let state = State.BLOCKED;
    if (implemented && evidenceLayer?.ready) state = State.PRODUCTION_READY;
    else if (implemented && id === 'L4') state = State.DEPLOYMENT_READY;
    else if (implemented) state = State.EXTERNAL_EVIDENCE_REQUIRED;
    return Object.freeze({
      id,
      codeImplemented: Boolean(implemented),
      externalEvidenceReady: Boolean(evidenceLayer?.ready),
      state,
      missingExternalEvidence: Object.freeze(evidenceLayer?.missing || []),
    });
  });

  return Object.freeze({
    product: 'LANERIQ Anti Scam',
    staticStorePackage: staticGate.readyForExternalEvidenceCollection ? 'READY' : 'BLOCKED',
    allFiveLayerCodeSurfacesImplemented: layers.every(layer => layer.codeImplemented),
    publicProduction: launch.publicProduction,
    layers: Object.freeze(layers),
    truth: launch.publicProduction === 'READY'
      ? 'All five layers have verified external evidence for the evaluated release.'
      : 'Code implementation does not equal production evidence. Public Production remains blocked until the signed external gates are satisfied for the exact shipping build.',
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildL1L5ExecutionStatus(), null, 2));
}
