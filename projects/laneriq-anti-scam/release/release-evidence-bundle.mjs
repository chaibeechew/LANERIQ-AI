import { readFileSync } from 'node:fs';
import { verifyPinnedReleaseEvidence } from './release-evidence-attestation.mjs';
import { ReleaseGateId } from './release-readiness.mjs';

const DEFAULT_BUNDLE_URL = new URL('./PUBLIC_RELEASE_EVIDENCE.json', import.meta.url);

const FIELD_BY_GATE = Object.freeze({
  [ReleaseGateId.L1_REAL_SYSTEM_WEB_SHIELD]: 'realSystemWebShield',
  [ReleaseGateId.L1_VPN_CONSENT]: 'vpnConsentFlowVerified',
  [ReleaseGateId.L1_VPN_NETWORK_MATRIX]: 'vpnIpv4Ipv6HandoffVerified',
  [ReleaseGateId.L1_SIGNED_REPUTATION_ANDROID]: 'signedThreatReputationInAndroid',
  [ReleaseGateId.L1_WEB_FALSE_POSITIVE]: 'webFalsePositiveBenchmarkPassed',

  [ReleaseGateId.L2_REPUTATION_PROVIDER]: 'trustedMalwareReputationProvider',
  [ReleaseGateId.L2_SCANNER_SANDBOX]: 'trustedScannerOrSandboxProvider',
  [ReleaseGateId.L2_SIGNED_MALWARE_ANDROID]: 'signedMalwareEvidenceInAndroid',
  [ReleaseGateId.L2_MALICIOUS_CORPUS]: 'maliciousCorpusBenchmarkPassed',
  [ReleaseGateId.L2_BENIGN_FALSE_POSITIVE]: 'benignFalsePositiveBenchmarkPassed',

  [ReleaseGateId.L3_PROCESS_KILL]: 'processKillVerified',
  [ReleaseGateId.L3_FORCE_STOP]: 'forceStopBoundaryVerified',
  [ReleaseGateId.L3_REBOOT_UPDATE]: 'rebootUpdateRecoveryVerified',
  [ReleaseGateId.L3_NOTIFICATION_BATTERY_THERMAL]: 'notificationBatteryThermalVerified',
  [ReleaseGateId.L3_SOAK_24H]: 'soak24hPassed',
  [ReleaseGateId.L3_OEM_MATRIX]: 'oemMatrixPassed',
  [ReleaseGateId.L3_APP_BUILDER_WITNESS]: 'appBuilderWitnessCoexistencePassed',

  [ReleaseGateId.L4_CLOUD_DEADMAN]: 'cloudDeadManDeployed',
  [ReleaseGateId.L4_PSEUDONYM_KEYS]: 'scopedPseudonymKeyManagementVerified',
  [ReleaseGateId.L4_RETENTION_PRIVACY]: 'retentionRateLimitRegionalPrivacyVerified',
  [ReleaseGateId.L4_SIGNING_KEY_CUSTODY]: 'productionSigningKeyCustodyVerified',
  [ReleaseGateId.L4_IMMUTABLE_AUDIT]: 'immutableAuditStorageVerified',
  [ReleaseGateId.L4_CANARY_ROLLBACK]: 'canaryKillSwitchRollbackVerified',

  [ReleaseGateId.L5_MULTI_REGION]: 'multiRegionActiveActiveVerified',
  [ReleaseGateId.L5_FAILOVER_SLO]: 'failoverSloVerified',
  [ReleaseGateId.L5_LOAD_COST]: 'stagedLoadCostEvidenceVerified',
  [ReleaseGateId.L5_GOOGLE_PLAY_DECLARATIONS]: 'googlePlayDeclarationsVerified',
  [ReleaseGateId.L5_PRIVACY_DATA_SAFETY]: 'privacyPolicyAndDataSafetyVerified',
  [ReleaseGateId.L5_SIGNED_PRODUCTION_ARTIFACT]: 'productionSignedArtifactVerified',
  [ReleaseGateId.L5_EXACT_MAIN_ALIGNMENT]: 'exactMainAlignmentVerified',
  [ReleaseGateId.L5_MAIN_BRANCH_PROTECTION]: 'mainBranchProtectionVerified',
  [ReleaseGateId.L5_PRODUCTION_SHA_CONVERGENCE]: 'productionReleaseShaConvergenceVerified',
});

export function loadVerifiedReleaseEvidenceBundle({
  url = DEFAULT_BUNDLE_URL,
  nowMs = Date.now(),
} = {}) {
  const raw = JSON.parse(readFileSync(url, 'utf8'));
  if (raw?.schema !== 1 || raw?.product !== 'LANERIQ Anti Scam' || !Array.isArray(raw?.tokens)) {
    throw new Error('invalid LANERIQ Anti Scam release evidence bundle');
  }

  const evidence = {};
  const verifiedGateIds = [];
  const rejected = [];

  for (const entry of raw.tokens) {
    const token = verifyPinnedReleaseEvidence({
      payload: entry?.payload,
      signatureBase64: entry?.signatureBase64,
      nowMs,
    });
    if (!token) {
      rejected.push(entry?.payload?.gateId || 'unknown');
      continue;
    }
    const field = FIELD_BY_GATE[token.gateId];
    if (!field) {
      rejected.push(token.gateId);
      continue;
    }
    if (evidence[field]) {
      throw new Error(`duplicate verified release evidence for ${token.gateId}`);
    }
    evidence[field] = token;
    verifiedGateIds.push(token.gateId);
  }

  return Object.freeze({
    evidence: Object.freeze(evidence),
    verifiedGateIds: Object.freeze(verifiedGateIds.sort()),
    rejectedGateIds: Object.freeze(rejected.sort()),
    totalTokens: raw.tokens.length,
  });
}

export function releaseEvidenceFieldCoverage() {
  return Object.freeze({ ...FIELD_BY_GATE });
}
