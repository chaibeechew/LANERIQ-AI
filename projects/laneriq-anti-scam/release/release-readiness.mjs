import { isVerifiedReleaseEvidence } from './release-evidence-attestation.mjs';

export const ReleaseChannel = Object.freeze({
  INTERNAL_TEST: 'INTERNAL_TEST',
  CLOSED_TEST: 'CLOSED_TEST',
  PUBLIC_PRODUCTION: 'PUBLIC_PRODUCTION',
});

export const ReadinessState = Object.freeze({
  READY: 'READY',
  BLOCKED: 'BLOCKED',
});

export const ReleaseGateId = Object.freeze({
  L1_REAL_SYSTEM_WEB_SHIELD: 'L1.real_system_web_shield',
  L1_VPN_CONSENT: 'L1.vpn_consent',
  L1_VPN_NETWORK_MATRIX: 'L1.vpn_ipv4_ipv6_handoff',
  L1_SIGNED_REPUTATION_ANDROID: 'L1.signed_threat_reputation_android',
  L1_WEB_FALSE_POSITIVE: 'L1.web_false_positive_benchmark',

  L2_REPUTATION_PROVIDER: 'L2.trusted_malware_reputation_provider',
  L2_SCANNER_SANDBOX: 'L2.trusted_scanner_or_sandbox_provider',
  L2_SIGNED_MALWARE_ANDROID: 'L2.signed_malware_evidence_android',
  L2_MALICIOUS_CORPUS: 'L2.malicious_corpus_benchmark',
  L2_BENIGN_FALSE_POSITIVE: 'L2.benign_false_positive_benchmark',

  L3_PROCESS_KILL: 'L3.process_kill',
  L3_FORCE_STOP: 'L3.force_stop_boundary',
  L3_REBOOT_UPDATE: 'L3.reboot_update_recovery',
  L3_NOTIFICATION_BATTERY_THERMAL: 'L3.notification_battery_thermal',
  L3_SOAK_24H: 'L3.soak_24h',
  L3_OEM_MATRIX: 'L3.oem_matrix',
  L3_APP_BUILDER_WITNESS: 'L3.app_builder_witness_coexistence',

  L4_CLOUD_DEADMAN: 'L4.cloud_deadman_deployed',
  L4_PSEUDONYM_KEYS: 'L4.scoped_pseudonym_key_management',
  L4_RETENTION_PRIVACY: 'L4.retention_rate_limit_regional_privacy',
  L4_SIGNING_KEY_CUSTODY: 'L4.production_signing_key_custody',
  L4_IMMUTABLE_AUDIT: 'L4.immutable_audit_storage',
  L4_CANARY_ROLLBACK: 'L4.canary_kill_switch_rollback',

  L5_MULTI_REGION: 'L5.multi_region_active_active',
  L5_FAILOVER_SLO: 'L5.failover_slo',
  L5_LOAD_COST: 'L5.staged_load_cost',
  L5_GOOGLE_PLAY_DECLARATIONS: 'L5.google_play_declarations',
  L5_PRIVACY_DATA_SAFETY: 'L5.privacy_policy_data_safety',
  L5_SIGNED_PRODUCTION_ARTIFACT: 'L5.production_signed_artifact',
  L5_EXACT_MAIN_ALIGNMENT: 'L5.exact_main_alignment',
  L5_MAIN_BRANCH_PROTECTION: 'L5.main_branch_protection_required_checks',
  L5_PRODUCTION_SHA_CONVERGENCE: 'L5.production_release_exact_sha_convergence',
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

function attested(evidence, field, gateId) {
  return isVerifiedReleaseEvidence(evidence[field], gateId);
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
 * Public-production external evidence must be a verified, pinned signed token.
 * Bare booleans cannot satisfy those gates. Only static source facts remain booleans.
 */
export function evaluateFiveLayerReadiness(evidence = {}) {
  const l1 = layer('L1_REALTIME_INTERCEPTION', {
    androidTargetApi36: evidence.androidTargetApi36 === true,
    productionApplicationId: evidence.productionApplicationId === true,
    realSystemWebShield: attested(evidence, 'realSystemWebShield', ReleaseGateId.L1_REAL_SYSTEM_WEB_SHIELD),
    vpnConsentFlowVerified: attested(evidence, 'vpnConsentFlowVerified', ReleaseGateId.L1_VPN_CONSENT),
    vpnIpv4Ipv6HandoffVerified: attested(evidence, 'vpnIpv4Ipv6HandoffVerified', ReleaseGateId.L1_VPN_NETWORK_MATRIX),
    signedThreatReputationInAndroid: attested(evidence, 'signedThreatReputationInAndroid', ReleaseGateId.L1_SIGNED_REPUTATION_ANDROID),
    webFalsePositiveBenchmarkPassed: attested(evidence, 'webFalsePositiveBenchmarkPassed', ReleaseGateId.L1_WEB_FALSE_POSITIVE),
  });

  const l2 = layer('L2_MALWARE_EFFICACY', {
    trustedMalwareReputationProvider: attested(evidence, 'trustedMalwareReputationProvider', ReleaseGateId.L2_REPUTATION_PROVIDER),
    trustedScannerOrSandboxProvider: attested(evidence, 'trustedScannerOrSandboxProvider', ReleaseGateId.L2_SCANNER_SANDBOX),
    signedMalwareEvidenceInAndroid: attested(evidence, 'signedMalwareEvidenceInAndroid', ReleaseGateId.L2_SIGNED_MALWARE_ANDROID),
    maliciousCorpusBenchmarkPassed: attested(evidence, 'maliciousCorpusBenchmarkPassed', ReleaseGateId.L2_MALICIOUS_CORPUS),
    benignFalsePositiveBenchmarkPassed: attested(evidence, 'benignFalsePositiveBenchmarkPassed', ReleaseGateId.L2_BENIGN_FALSE_POSITIVE),
  });

  const l3 = layer('L3_GUARDIAN_REAL_DEVICE', {
    processKillVerified: attested(evidence, 'processKillVerified', ReleaseGateId.L3_PROCESS_KILL),
    forceStopBoundaryVerified: attested(evidence, 'forceStopBoundaryVerified', ReleaseGateId.L3_FORCE_STOP),
    rebootUpdateRecoveryVerified: attested(evidence, 'rebootUpdateRecoveryVerified', ReleaseGateId.L3_REBOOT_UPDATE),
    notificationBatteryThermalVerified: attested(evidence, 'notificationBatteryThermalVerified', ReleaseGateId.L3_NOTIFICATION_BATTERY_THERMAL),
    soak24hPassed: attested(evidence, 'soak24hPassed', ReleaseGateId.L3_SOAK_24H),
    oemMatrixPassed: attested(evidence, 'oemMatrixPassed', ReleaseGateId.L3_OEM_MATRIX),
    appBuilderWitnessCoexistencePassed: attested(evidence, 'appBuilderWitnessCoexistencePassed', ReleaseGateId.L3_APP_BUILDER_WITNESS),
  });

  const l4 = layer('L4_PRODUCTION_TRUST_CLOUD', {
    cloudDeadManDeployed: attested(evidence, 'cloudDeadManDeployed', ReleaseGateId.L4_CLOUD_DEADMAN),
    scopedPseudonymKeyManagementVerified: attested(evidence, 'scopedPseudonymKeyManagementVerified', ReleaseGateId.L4_PSEUDONYM_KEYS),
    retentionRateLimitRegionalPrivacyVerified: attested(evidence, 'retentionRateLimitRegionalPrivacyVerified', ReleaseGateId.L4_RETENTION_PRIVACY),
    productionSigningKeyCustodyVerified: attested(evidence, 'productionSigningKeyCustodyVerified', ReleaseGateId.L4_SIGNING_KEY_CUSTODY),
    immutableAuditStorageVerified: attested(evidence, 'immutableAuditStorageVerified', ReleaseGateId.L4_IMMUTABLE_AUDIT),
    canaryKillSwitchRollbackVerified: attested(evidence, 'canaryKillSwitchRollbackVerified', ReleaseGateId.L4_CANARY_ROLLBACK),
  });

  const l5 = layer('L5_PRODUCTION_SCALE_STORE', {
    multiRegionActiveActiveVerified: attested(evidence, 'multiRegionActiveActiveVerified', ReleaseGateId.L5_MULTI_REGION),
    failoverSloVerified: attested(evidence, 'failoverSloVerified', ReleaseGateId.L5_FAILOVER_SLO),
    stagedLoadCostEvidenceVerified: attested(evidence, 'stagedLoadCostEvidenceVerified', ReleaseGateId.L5_LOAD_COST),
    googlePlayDeclarationsVerified: attested(evidence, 'googlePlayDeclarationsVerified', ReleaseGateId.L5_GOOGLE_PLAY_DECLARATIONS),
    privacyPolicyAndDataSafetyVerified: attested(evidence, 'privacyPolicyAndDataSafetyVerified', ReleaseGateId.L5_PRIVACY_DATA_SAFETY),
    productionSignedArtifactVerified: attested(evidence, 'productionSignedArtifactVerified', ReleaseGateId.L5_SIGNED_PRODUCTION_ARTIFACT),
    exactMainAlignmentVerified: attested(evidence, 'exactMainAlignmentVerified', ReleaseGateId.L5_EXACT_MAIN_ALIGNMENT),
    mainBranchProtectionVerified: attested(evidence, 'mainBranchProtectionVerified', ReleaseGateId.L5_MAIN_BRANCH_PROTECTION),
    productionReleaseShaConvergenceVerified: attested(evidence, 'productionReleaseShaConvergenceVerified', ReleaseGateId.L5_PRODUCTION_SHA_CONVERGENCE),
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
    const ready = staticBuildReady && evidence.testArtifactSigned === true;
    return Object.freeze({ channel, ready, state: ready ? ReadinessState.READY : ReadinessState.BLOCKED });
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
