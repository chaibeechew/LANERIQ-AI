import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeAntiScamProviderRow } from '../app-builder-witness-consumer.mjs';

const provider = readFileSync(new URL('../../android/app/src/main/java/ai/laneriq/antiscam/ProtectionStatusProvider.java', import.meta.url), 'utf8');
const consumer = readFileSync(new URL('../app-builder-witness-consumer.mjs', import.meta.url), 'utf8');

function minimalRow() {
  return {
    schema_version: 10,
    state: 'ACTIVE',
    lease_epoch: 1,
    lease_expires_at_ms: Date.now() + 60_000,
    heartbeat_sequence: 1,
    policy_version: 'test',
    emergency_level: 'NONE',
    integrity_state: 'ACTIVE_VERIFIED',
    freeze_sensitive_laneriq_actions: 0,
    alert_delivery_state: 'AVAILABLE',
    witness_proof_schema: 1,
    witness_proof_available: 1,
    witness_key_id_sha256: 'a'.repeat(64),
    witness_public_key_b64: 'test',
    witness_signature_b64: 'test',
    witness_observed_at_ms: Date.now(),
  };
}

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

test('L3 production Witness defaults only to production package', () => {
  const normalized = normalizeAntiScamProviderRow(minimalRow());
  assert.equal(normalized.cryptoProof.packageName, 'ai.laneriq.antiscam');
  assert.throws(() => normalizeAntiScamProviderRow(minimalRow(), {
    expectedPackageName: 'ai.laneriq.antiscam.test',
  }), /ANTI_SCAM_EXPECTED_PACKAGE_NOT_ALLOWED/);
});

test('L3 test package requires explicit allowTestPackage and arbitrary packages stay forbidden', () => {
  const normalized = normalizeAntiScamProviderRow(minimalRow(), {
    expectedPackageName: 'ai.laneriq.antiscam.test',
    allowTestPackage: true,
  });
  assert.equal(normalized.cryptoProof.packageName, 'ai.laneriq.antiscam.test');
  assert.throws(() => normalizeAntiScamProviderRow(minimalRow(), {
    expectedPackageName: 'evil.copy',
    allowTestPackage: true,
  }), /ANTI_SCAM_EXPECTED_PACKAGE_NOT_ALLOWED/);
});

test('L3 App Builder consumer remains a security consumer, not a second Guardian or VPN owner', () => {
  assert.doesNotMatch(consumer, /startForegroundService|startService|VpnService|GuardianService/);
  assert.match(consumer, /never starts a second Guardian/);
});
