import fs from 'node:fs';
import path from 'node:path';

export function evaluateStaticStorePackage(root = process.cwd()) {
  const project = path.join(root, 'projects/laneriq-anti-scam');
  const read = (relative) => fs.readFileSync(path.join(project, relative), 'utf8');
  const exists = (relative) => fs.existsSync(path.join(project, relative));

  const checklist = JSON.parse(read('release/STORE_SUBMISSION_CHECKLIST.json'));
  const appGradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const guardian = read('android/app/src/main/java/ai/laneriq/antiscam/GuardianService.java');
  const webShieldVpn = read('android/app/src/main/java/ai/laneriq/antiscam/WebShieldVpnService.java');
  const webShieldContract = read('android/app/src/main/java/ai/laneriq/antiscam/WebShieldDataPlaneContract.java');
  const signedReputation = read('android/app/src/main/java/ai/laneriq/antiscam/SignedThreatReputationEvidence.java');
  const reputationStore = read('android/app/src/main/java/ai/laneriq/antiscam/LocalThreatReputationStore.java');
  const feedKeys = read('android/app/src/main/java/ai/laneriq/antiscam/TrustedThreatFeedKeys.java');
  const malwareBroker = read('cloud/lib/malware-defense-broker.mjs');
  const deepScan = read('cloud/lib/selected-file-scan-handler.mjs');
  const heartbeatHandler = read('cloud/lib/guardian-heartbeat-handler.mjs');
  const deadmanSql = read('cloud/sql/001_guardian_deadman.sql');
  const prTruth = read('release/STORE_READINESS_2026.md');
  const signingContract = read('release/ANDROID_PRODUCTION_SIGNING.md');

  const checks = {
    productionApplicationId: /applicationId\s+['"]ai\.laneriq\.antiscam['"]/.test(appGradle),
    debugIdentitySeparated: /applicationIdSuffix\s+['"]\.test['"]/.test(appGradle),
    compileSdk36: /compileSdk\s+36\b/.test(appGradle),
    targetSdk36: /targetSdk\s+36\b/.test(appGradle),
    releaseLintEnabled: /checkReleaseBuilds\s+true/.test(appGradle),
    productionSigningFailsClosed: /verifyProductionSigningConfigured/.test(appGradle)
      && /Production signing inputs are not configured/.test(appGradle),
    backupDisabled: /android:allowBackup=['"]false['"]/.test(manifest),
    cleartextDisabled: /android:usesCleartextTraffic=['"]false['"]/.test(manifest),
    appLabelBuildSpecific: /android:label=['"]@string\/app_name['"]/.test(manifest),
    protectionProviderSignaturePermission: /android:protectionLevel=['"]signature['"]/.test(manifest)
      && /android:permission=['"]ai\.laneriq\.antiscam\.permission\.READ_PROTECTION_STATUS['"]/.test(manifest),
    specialUseFgsPermission: /android\.permission\.FOREGROUND_SERVICE_SPECIAL_USE/.test(manifest),
    specialUseFgsManifestType: /android:foregroundServiceType=['"]specialUse['"]/.test(manifest),
    specialUseFgsSubtypeExplanation: /android\.app\.PROPERTY_SPECIAL_USE_FGS_SUBTYPE/.test(manifest)
      && /anti-scam Guardian device-risk monitoring/i.test(manifest),
    specialUseFgsRuntimeType: /FOREGROUND_SERVICE_TYPE_SPECIAL_USE/.test(guardian)
      && /Build\.VERSION_CODES\.UPSIDE_DOWN_CAKE/.test(guardian),

    l1VpnServicePlatformProtected: /android:name=['"]\.WebShieldVpnService['"]/.test(manifest)
      && /android:permission=['"]android\.permission\.BIND_VPN_SERVICE['"]/.test(manifest)
      && /android:name=['"]android\.net\.VpnService['"]/.test(manifest),
    l1VpnConsentRequired: /VpnService\.prepare\(this\)/.test(webShieldVpn),
    l1FakeTunnelForbidden: /isProductionDataPlaneReady\(\)/.test(webShieldVpn)
      && /return false;/.test(webShieldContract)
      && /markTunnel\(false, false, false/.test(webShieldVpn),

    signedReputationCryptoPathPresent: /SHA256withECDSA/.test(signedReputation)
      && /productionVerifier\(\)/.test(signedReputation)
      && /VerifiedEvidence/.test(signedReputation),
    signedReputationCacheReverified: /reverifySignedEnvelope/.test(reputationStore)
      && /productionVerifier\(\)\.verify/.test(reputationStore),
    threatFeedTrustRootExplicitAndFailClosed: /pinnedX509Base64BySource/.test(feedKeys)
      && !/["']\*["']/.test(feedKeys)
      && !/acceptAny|trustAll|allowAll/i.test(feedKeys)
      && /pinnedKeys\.get\(payload\.sourceId\)/.test(signedReputation)
      && /publicKeyBase64 == null/.test(signedReputation),
    l2SharedMalwareBrokerHashBound: /MULTI_ENGINE_HASH_VERIFIED_SIGNED_MALICIOUS/.test(malwareBroker)
      && /SINGLE_SIGNED_PROVIDER_MALICIOUS_REQUIRES_CONFIRMATION/.test(malwareBroker)
      && /RAW_SAMPLE_UPLOAD_NOT_AUTHORIZED/.test(malwareBroker)
      && /INVALID_MALWARE_RECEIPT_SIGNATURE/.test(malwareBroker)
      && /receipt\.sha256/.test(malwareBroker),
    l2DeepScanConsentAndAttestation: /SCAN_CONSENT_NOT_HASH_BOUND/.test(deepScan)
      && /SCAN_CONSENT_STALE_OR_INVALID/.test(deepScan)
      && /SCAN_APP_ATTESTATION_REJECTED/.test(deepScan)
      && /SCAN_HASH_MISMATCH/.test(deepScan),

    l3RealDeviceHarnessPresent: exists('release/device-tests/android-guardian-matrix.sh')
      && exists('release/l3-device-evidence.mjs'),

    l4AttestationAndWitnessRequired: /APP_ATTESTATION_VERIFIER_NOT_CONFIGURED/.test(heartbeatHandler)
      && /APP_INTEGRITY_NOT_VERIFIED/.test(heartbeatHandler)
      && /INVALID_GUARDIAN_WITNESS_PROOF/.test(heartbeatHandler),
    l4PrivateHeartbeatFieldsRejected: /GUARDIAN_PAYLOAD_FORBIDDEN_FIELDS/.test(heartbeatHandler),
    l4DeadmanRlsAndReplayProtection: /enable row level security/i.test(deadmanSql)
      && /revoke all on table public\.anti_scam_guardian_leases from anon, authenticated/i.test(deadmanSql)
      && /p_lease_epoch < current_row\.lease_epoch/.test(deadmanSql)
      && /p_heartbeat_sequence <= current_row\.heartbeat_sequence/.test(deadmanSql),

    privacyPolicyDraftPresent: exists('release/PRIVACY_POLICY_DRAFT.md'),
    playDeclarationDraftPresent: exists('release/GOOGLE_PLAY_DECLARATIONS_DRAFT.md'),
    signingContractPresent: exists('release/ANDROID_PRODUCTION_SIGNING.md')
      && /must never be signed with the debug key/i.test(signingContract),
    storeListingTruthDraftPresent: exists('release/STORE_LISTING_COPY_DRAFT.md'),
    iosReadinessContractPresent: exists('release/IOS_STORE_READINESS.md'),
    fiveLayerExitGatesPresent: exists('release/FIVE_LAYER_EXIT_GATES.md'),
    storeReadinessPresent: exists('release/STORE_READINESS_2026.md'),
    checklistPackageMatches: checklist?.android?.applicationId === 'ai.laneriq.antiscam',
    checklistTargetMatches: checklist?.android?.targetSdk === 36,
    publicProductionStillEvidenceGated: /PUBLIC PRODUCTION/i.test(prTruth)
      && /(BLOCKED|not ready|not authorized|must not)/i.test(prTruth),
  };

  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return Object.freeze({
    readyForExternalEvidenceCollection: failures.length === 0,
    failures: Object.freeze(failures),
    checks: Object.freeze(checks),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = evaluateStaticStorePackage(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (!result.readyForExternalEvidenceCollection) process.exit(1);
}
