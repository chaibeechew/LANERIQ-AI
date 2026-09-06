import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const provider = readFileSync(new URL('../../android/app/src/main/java/ai/laneriq/antiscam/ProtectionStatusProvider.java', import.meta.url), 'utf8');
const consumer = readFileSync(new URL('../app-builder-witness-consumer.mjs', import.meta.url), 'utf8');

test('L3 Provider exposes lease epoch required to reconstruct the signed Witness payload', () => {
  assert.match(provider, /"lease_epoch"/);
  assert.match(provider, /lease\.epoch, lease\.expiresAtMs, lease\.heartbeatSequence/);
});

test('L3 Provider uses live Web Shield truth instead of a hard-coded feature=false snapshot', () => {
  assert.match(provider, /WebShieldStateStore\.State webShield/);
  assert.match(provider, /webShield\.asCapabilityEvidence\(\)/);
  assert.doesNotMatch(provider, /new NetworkProtectionCapability\.Evidence\(false/);
});

test('L3 App Builder consumer is pinned to Provider schema v10 and actual Witness column names', () => {
  assert.match(provider, /10, lease\.state\.name\(\)/);
  assert.match(consumer, /schemaVersion < 10/);
  assert.match(consumer, /row\.witness_public_key_b64/);
  assert.match(consumer, /row\.witness_signature_b64/);
  assert.match(consumer, /row\.witness_observed_at_ms/);
});

test('L3 App Builder consumer remains a security consumer, not a second Guardian or VPN owner', () => {
  assert.doesNotMatch(consumer, /startForegroundService|startService|VpnService|GuardianService/);
  assert.match(consumer, /never starts a second Guardian/);
});
