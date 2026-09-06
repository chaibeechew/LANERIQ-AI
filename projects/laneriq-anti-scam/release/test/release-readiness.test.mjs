import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ReleaseChannel,
  ReadinessState,
  evaluateAndroidChannel,
  evaluateFiveLayerReadiness,
} from '../release-readiness.mjs';

const buildGradle = readFileSync(
  new URL('../../android/app/build.gradle', import.meta.url),
  'utf8',
);
const manifest = readFileSync(
  new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);

test('2026 Google Play static build baseline targets API 36 and separates production/test identities', () => {
  assert.match(buildGradle, /compileSdk 36/);
  assert.match(buildGradle, /targetSdk 36/);
  assert.match(buildGradle, /applicationId 'ai\.laneriq\.antiscam'/);
  assert.match(buildGradle, /applicationIdSuffix '\.test'/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
});

test('public production remains blocked when external evidence is absent', () => {
  const result = evaluateFiveLayerReadiness({
    androidTargetApi36: true,
    productionApplicationId: true,
  });
  assert.equal(result.publicProduction.state, ReadinessState.BLOCKED);
  assert.deepEqual(result.publicProduction.blockedLayers, [
    'L1_REALTIME_INTERCEPTION',
    'L2_MALWARE_EFFICACY',
    'L3_GUARDIAN_REAL_DEVICE',
    'L4_PRODUCTION_TRUST_CLOUD',
    'L5_PRODUCTION_SCALE_STORE',
  ]);
});

test('internal test cannot be called ready without real CI and signed test artifact evidence', () => {
  const result = evaluateAndroidChannel(ReleaseChannel.INTERNAL_TEST, {
    androidTargetApi36: true,
    productionApplicationId: true,
    truthGatePassed: true,
    privacyPermissionGatePassed: true,
    androidUnitLintBundlePassed: false,
    testArtifactSigned: false,
  });
  assert.equal(result.ready, false);
  assert.equal(result.state, ReadinessState.BLOCKED);
});

test('no single boolean can bypass five-layer public production readiness', () => {
  const result = evaluateAndroidChannel(ReleaseChannel.PUBLIC_PRODUCTION, {
    ready: true,
    publicProductionReady: true,
    androidTargetApi36: true,
    productionApplicationId: true,
  });
  assert.equal(result.ready, false);
  assert.equal(result.state, ReadinessState.BLOCKED);
});
