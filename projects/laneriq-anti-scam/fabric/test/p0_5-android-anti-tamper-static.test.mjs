import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guardian = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/GuardianService.java', import.meta.url),
  'utf8',
);
const mainActivity = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/MainActivity.java', import.meta.url),
  'utf8',
);
const gradle = readFileSync(
  new URL('../../android/app/build.gradle', import.meta.url),
  'utf8',
);
const provider = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/ProtectionStatusProvider.java', import.meta.url),
  'utf8',
);
const recoveryCenter = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/RecoveryCenterDialog.java', import.meta.url),
  'utf8',
);
const platformIntegrity = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/PlatformProtectionIntegrityPolicy.java', import.meta.url),
  'utf8',
);
const installSource = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/InstallSourceIntegrityStore.java', import.meta.url),
  'utf8',
);
const vpnOwnership = readFileSync(
  new URL('../../android/app/src/main/java/ai/laneriq/antiscam/VpnOwnershipIntegrityPolicy.java', import.meta.url),
  'utf8',
);

test('P0.5 persistent Guardian notification has no one-tap Stop action', () => {
  assert.equal(guardian.includes('"Stop Guardian"'), false);
  assert.equal(guardian.includes('addAction(android.R.drawable.ic_menu_close_clear_cancel'), false);
  assert.match(guardian, /"Open Anti Scam"/);
});

test('P0.5 in-app Pause button routes through GuardianPausePolicy flow', () => {
  assert.match(mainActivity, /stop\.setOnClickListener\(v -> requestPauseGuardian\(\)\)/);
  assert.match(mainActivity, /GuardianPausePolicy\.evaluate/);
  assert.match(mainActivity, /BLOCK_DURING_URGENT_RISK/);
  assert.match(mainActivity, /showFinalPauseConfirmation/);
  assert.match(mainActivity, /stopGuardianConfirmed/);
});

test('P0.5 elevated-risk Pause requires Android device credential step-up', () => {
  assert.match(mainActivity, /KeyguardManager/);
  assert.match(mainActivity, /REQUEST_CONFIRM_PAUSE_CREDENTIAL/);
  assert.match(mainActivity, /createConfirmDeviceCredentialIntent/);
  assert.match(mainActivity, /requestDeviceCredentialForPause/);
  assert.match(mainActivity, /manager\.isDeviceSecure\(\)/);
});

test('P0.5 direct stop remains an internal service action, not an exported notification control', () => {
  assert.match(guardian, /ACTION_STOP/);
  assert.equal(guardian.includes('PendingIntent.getService(\n                this, 2, stop'), false);
});

test('P0.5 visible test-build version matches Gradle versionName', () => {
  const match = gradle.match(/versionName\s+'([^']+)'/);
  assert.ok(match, 'versionName missing from Gradle');
  assert.ok(mainActivity.includes(match[1]), `MainActivity must surface current test-build version ${match[1]}`);
});

test('P0.5 recovery center only opens user-controlled Android settings', () => {
  assert.match(recoveryCenter, /ACTION_APP_NOTIFICATION_SETTINGS/);
  assert.match(recoveryCenter, /ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS/);
  assert.match(recoveryCenter, /ACTION_ACCESSIBILITY_SETTINGS/);
  assert.match(recoveryCenter, /ACTION_VPN_SETTINGS/);
  assert.match(recoveryCenter, /ACTION_APPLICATION_DETAILS_SETTINGS/);
  assert.equal(recoveryCenter.includes('setEnabledSetting'), false);
});

test('P0.5 companion provider exposes platform/install-source truth but no private history', () => {
  assert.match(provider, /platform_integrity_state/);
  assert.match(provider, /install_source_integrity_state/);
  assert.match(provider, /background_restricted/);
  assert.match(provider, /battery_optimization_exemption/);
  assert.equal(provider.includes('raw_url'), false);
  assert.equal(provider.includes('event_log'), false);
  assert.equal(provider.includes('message_body'), false);
});

test('P0.5 platform restriction policy never attributes a restriction to a hacker', () => {
  assert.match(platformIntegrity, /hackerAttributionAllowed = false/);
  assert.match(platformIntegrity, /MULTIPLE_RESTRICTIONS/);
});

test('P0.5 install-source change is review evidence, not hacker attribution', () => {
  assert.match(installSource, /InstallSourceContinuityPolicy/);
  assert.equal(installSource.includes('hacker'), false);
});

test('P0.5 VPN ownership cannot claim system-wide Web Shield before verified ownership', () => {
  assert.match(vpnOwnership, /NOT_APPLICABLE/);
  assert.match(vpnOwnership, /OWNERSHIP_LOST/);
  assert.match(vpnOwnership, /mayClaimSystemWideWebShield/);
  assert.match(vpnOwnership, /hackerAttributionAllowed = false/);
});
