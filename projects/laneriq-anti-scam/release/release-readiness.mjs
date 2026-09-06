export const ReleaseChannel = Object.freeze({
  INTERNAL_TEST: 'INTERNAL_TEST',
  CLOSED_TEST: 'CLOSED_TEST',
  PUBLIC_PRODUCTION: 'PUBLIC_PRODUCTION',
});

export const ReadinessState = Object.freeze({
  READY: 'READY',
  BLOCKED: 'BLOCKED',
});

const REQUIRED_LAYERS = Object.freeze([
  'L1_REALTIME_INTERCEPTION',
  'L2_MALWARE_EFFICACY',
  'L3_GUARDIAN_REAL_DEVICE',
  'L4_PRODUCTION_TRUST_CLOUD',
  'L5_PRODUCTION_SCALE_STORE',
]);

function allTrue(values) {
  return values.every((value) => value === true);
}

function layer(id, checks) {
  const entries = Object.entries(checks);
  const missing = entries.filter(([, value]) => value !== true).map(([name]) => name);
  return Object.freeze({
    id,
    ready: missing.length === 0,
    missing: Object.freeze(missing),
  });
}

/**
 * Evidence object only accepts concrete facts measured or independently verified
 * elsewhere. This evaluator never manufactures external evidence from code existence.
 */
export function evaluateFiveLayerReadiness(evidence = {}) {
  const l1 = layer('L1_REALTIME_INTERCEPTION', {
    androidTargetApi36: evidence.androidTargetApi36,
    productionApplicationId: evidence.productionApplicationId,
    realSystemWebShield: evidence.realSystemWebShield,
    vpnConsentFlowVerified: evidence.vpnConsentFlowVerified,
    vpnIpv4Ipv6HandoffVerified: evidence.vpnIpv4Ipv6HandoffVerified,
    signedThreatReputationInAndroid: evidence.signedThreatReputationInAndroid,
    webFalsePositiveBenchmarkPassed: evidence.webFalsePositiveBenchmarkPassed,
  });

  const l2 = layer('L2_MALWARE_EFFICACY', {
    trustedMalwareReputationProvider: evidence.trustedMalwareReputationProvider,
    trustedScannerOrSandboxProvider: evidence.trustedScannerOrSandboxProvider,
    signedMalwareEvidenceInAndroid: evidence.signedMalwareEvidenceInAndroid,
    maliciousCorpusBenchmarkPassed: evidence.maliciousCorpusBenchmarkPassed,
    benignFalsePositiveBenchmarkPassed: evidence.benignFalsePositiveBenchmarkPassed,
  });

  const l3 = layer('L3_GUARDIAN_REAL_DEVICE', {
    processKillVerified: evidence.processKillVerified,
    forceStopBoundaryVerified: evidence.forceStopBoundaryVerified,
    rebootUpdateRecoveryVerified: evidence.rebootUpdateRecoveryVerified,
    notificationBatteryThermalVerified: evidence.notificationBatteryThermalVerified,
    soak24hPassed: evidence.soak24hPassed,
    oemMatrixPassed: evidence.oemMatrixPassed,
    appBuilderWitnessCoexistencePassed: evidence.appBuilderWitnessCoexistencePassed,
  });

  const l4 = layer('L4_PRODUCTION_TRUST_CLOUD', {
    cloudDeadManDeployed: evidence.cloudDeadManDeployed,
    scopedPseudonymKeyManagementVerified: evidence.scopedPseudonymKeyManagementVerified,
    retentionRateLimitRegionalPrivacyVerified: evidence.retentionRateLimitRegionalPrivacyVerified,
    productionSigningKeyCustodyVerified: evidence.productionSigningKeyCustodyVerified,
    immutableAuditStorageVerified: evidence.immutableAuditStorageVerified,
    canaryKillSwitchRollbackVerified: evidence.canaryKillSwitchRollbackVerified,
  });

  const l5 = layer('L5_PRODUCTION_SCALE_STORE', {
    multiRegionActiveActiveVerified: evidence.multiRegionActiveActiveVerified,
    failoverSloVerified: evidence.failoverSloVerified,
    stagedLoadCostEvidenceVerified: evidence.stagedLoadCostEvidenceVerified,
    googlePlayDeclarationsVerified: evidence.googlePlayDeclarationsVerified,
    privacyPolicyAndDataSafetyVerified: evidence.privacyPolicyAndDataSafetyVerified,
    productionSignedArtifactVerified: evidence.productionSignedArtifactVerified,
  });

  const layers = Object.freeze([l1, l2, l3, l4, l5]);
  const publicReady = layers.every((item) => item.ready);

  return Object.freeze({
    layers,
    requiredLayerIds: REQUIRED_LAYERS,
    publicProduction: Object.freeze({
      state: publicReady ? ReadinessState.READY : ReadinessState.BLOCKED,
      ready: publicReady,
      blockedLayers: Object.freeze(layers.filter((item) => !item.ready).map((item) => item.id)),
    }),
  });
}

export function evaluateAndroidChannel(channel, evidence = {}) {
  const staticBuildReady = allTrue([
    evidence.androidTargetApi36,
    evidence.productionApplicationId,
    evidence.androidUnitLintBundlePassed,
    evidence.truthGatePassed,
    evidence.privacyPermissionGatePassed,
  ]);

  if (channel === ReleaseChannel.INTERNAL_TEST) {
    return Object.freeze({
      channel,
      ready: staticBuildReady && evidence.testArtifactSigned === true,
      state: staticBuildReady && evidence.testArtifactSigned === true
        ? ReadinessState.READY
        : ReadinessState.BLOCKED,
    });
  }

  if (channel === ReleaseChannel.CLOSED_TEST) {
    const ready = staticBuildReady
      && evidence.testArtifactSigned === true
      && evidence.realDeviceSmokePassed === true
      && evidence.privacyDisclosureReviewed === true;
    return Object.freeze({ channel, ready, state: ready ? ReadinessState.READY : ReadinessState.BLOCKED });
  }

  if (channel === ReleaseChannel.PUBLIC_PRODUCTION) {
    const result = evaluateFiveLayerReadiness(evidence);
    return Object.freeze({
      channel,
      ready: result.publicProduction.ready,
      state: result.publicProduction.state,
      fiveLayer: result,
    });
  }

  throw new Error(`unsupported release channel: ${channel}`);
}
