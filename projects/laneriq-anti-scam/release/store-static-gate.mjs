import fs from 'node:fs';
import path from 'node:path';

export function evaluateStaticStorePackage(root = process.cwd()) {
  const project = path.join(root, 'projects/laneriq-anti-scam');
  const read = (relative) => fs.readFileSync(path.join(project, relative), 'utf8');
  const exists = (relative) => fs.existsSync(path.join(project, relative));

  const checklist = JSON.parse(read('release/STORE_SUBMISSION_CHECKLIST.json'));
  const appGradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const prTruth = read('release/STORE_READINESS_2026.md');

  const checks = {
    productionApplicationId: /applicationId\s+['"]ai\.laneriq\.antiscam['"]/.test(appGradle),
    debugIdentitySeparated: /applicationIdSuffix\s+['"]\.test['"]/.test(appGradle),
    compileSdk36: /compileSdk\s+36\b/.test(appGradle),
    targetSdk36: /targetSdk\s+36\b/.test(appGradle),
    releaseLintEnabled: /checkReleaseBuilds\s+true/.test(appGradle),
    backupDisabled: /android:allowBackup=['"]false['"]/.test(manifest),
    cleartextDisabled: /android:usesCleartextTraffic=['"]false['"]/.test(manifest),
    protectionProviderSignaturePermission: /android:protectionLevel=['"]signature['"]/.test(manifest)
      && /android:permission=['"]ai\.laneriq\.antiscam\.permission\.READ_PROTECTION_STATUS['"]/.test(manifest),
    privacyPolicyDraftPresent: exists('release/PRIVACY_POLICY_DRAFT.md'),
    playDeclarationDraftPresent: exists('release/GOOGLE_PLAY_DECLARATIONS_DRAFT.md'),
    signingContractPresent: exists('release/ANDROID_PRODUCTION_SIGNING.md'),
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
