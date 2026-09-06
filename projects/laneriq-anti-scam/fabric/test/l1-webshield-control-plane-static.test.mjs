import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const service = readFileSync(new URL('../../android/app/src/main/java/ai/laneriq/antiscam/WebShieldVpnService.java', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../../android/app/src/main/java/ai/laneriq/antiscam/WebShieldDataPlaneContract.java', import.meta.url), 'utf8');

test('L1 registers a platform VpnService protected by BIND_VPN_SERVICE', () => {
  assert.match(manifest, /android:name="\.WebShieldVpnService"/);
  assert.match(manifest, /android:permission="android\.permission\.BIND_VPN_SERVICE"/);
  assert.match(manifest, /android:name="android\.net\.VpnService"/);
});

test('L1 never establishes or claims a fake tunnel while the production packet engine is unverified', () => {
  assert.match(service, /WebShieldDataPlaneContract\.isProductionDataPlaneReady\(\)/);
  assert.match(service, /markTunnel\(false, false, false/);
  assert.match(contract, /return false;/);
});

test('L1 VPN start requires Android platform consent', () => {
  assert.match(service, /VpnService\.prepare\(this\)/);
  assert.match(service, /vpn-consent-required/);
  assert.match(service, /vpn-consent-present/);
});
