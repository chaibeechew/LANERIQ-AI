import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = readFileSync(
  new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);

const PROHIBITED_BY_DEFAULT = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
];

test('Privacy First: Android manifest does not request prohibited surveillance/broad-access permissions', () => {
  for (const permission of PROHIBITED_BY_DEFAULT) {
    assert.equal(
      manifest.includes(permission),
      false,
      `${permission} is prohibited by default; adding it requires a deliberate privacy-contract change`,
    );
  }
});

test('Privacy First: backups remain disabled and cleartext traffic remains disabled', () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
});

test('Privacy First: exported companion provider remains signature-permission protected', () => {
  assert.match(manifest, /android:protectionLevel="signature"/);
  assert.match(manifest, /android:readPermission="ai\.laneriq\.antiscam\.permission\.READ_PROTECTION_STATUS"/);
  assert.match(manifest, /android:writePermission="ai\.laneriq\.antiscam\.permission\.READ_PROTECTION_STATUS"/);
});
