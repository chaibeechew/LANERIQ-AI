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
