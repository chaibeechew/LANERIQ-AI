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

test('P0.5 direct stop remains an internal service action, not an exported notification control', () => {
  assert.match(guardian, /ACTION_STOP/);
  assert.equal(guardian.includes('PendingIntent.getService(\n                this, 2, stop'), false);
});

test('P0.5 visible test-build version matches Gradle versionName', () => {
  const match = gradle.match(/versionName\s+'([^']+)'/);
  assert.ok(match, 'versionName missing from Gradle');
  assert.ok(
    mainActivity.includes(match[1]),
    `MainActivity must surface current test-build version ${match[1]}`,
  );
});
