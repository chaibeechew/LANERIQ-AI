import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../../android/app/src/main/java/ai/laneriq/antiscam/WebShieldStateStore.java', import.meta.url), 'utf8');

test('L1 user opt-out clears stale tunnel and engine truth', () => {
  assert.match(store, /boolean tunnel = enabled && prefs\.getBoolean\("tunnel_established", false\)/);
  assert.match(store, /boolean healthy = enabled && prefs\.getBoolean\("engine_healthy", false\)/);
});

test('L1 a tunnel can only remain claimable when opted-in and VPN consent are both true', () => {
  assert.match(store, /boolean claimableTunnel = optedIn && consent && established/);
  assert.match(store, /boolean tunnel = optedIn && consent && prefs\.getBoolean\("tunnel_established", false\)/);
  assert.match(store, /boolean healthy = tunnel && prefs\.getBoolean\("engine_healthy", false\)/);
});
