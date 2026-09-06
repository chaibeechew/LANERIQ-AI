import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { canonicalGuardianWitness } from '../../cloud/lib/device-witness-verifier.mjs';
import { handleGuardianHeartbeat } from '../../cloud/lib/guardian-heartbeat-handler.mjs';
import { evaluateCloudDeadMan } from '../../cloud/lib/cloud-deadman.mjs';

const NOW = 1_800_000_000_000;
const PSEUDONYM_KEY = 'p'.repeat(48);

function signedProof(extraPayload = {}, extraProof = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const payload = {
    packageName: 'ai.laneriq.antiscam',
    leaseEpoch: 7,
    heartbeatSequence: 42,
    leaseExpiresAtMs: NOW + 90_000,
    integrityState: 'ACTIVE_VERIFIED',
    emergencyLevel: 'NONE',
    alertDeliveryState: 'AVAILABLE',
    policyVersion: 'p0.5-survival-1',
    observedAtMs: NOW,
    ...extraPayload,
  };
  const signature = crypto.sign('sha256', Buffer.from(canonicalGuardianWitness(payload), 'utf8'), privateKey);
  return {
    payload,
    publicKeyBase64: publicDer.toString('base64'),
    keyIdSha256: crypto.createHash('sha256').update(publicDer).digest('hex'),
    signatureBase64: signature.toString('base64'),
    ...extraProof,
  };
}

const goodAttestation = async () => ({ ok: true, packageName: 'ai.laneriq.antiscam', appIntegrityVerified: true });

test('L4 stores only pseudonymous minimal heartbeat after attestation + Keystore proof verification', async () => {
  let stored = null;
  const result = await handleGuardianHeartbeat({
    proof: signedProof(),
    attestationToken: 'test-attestation',
    nowMs: NOW,
    attestationVerifier: goodAttestation,
    pseudonymKey: PSEUDONYM_KEY,
    store: async record => { stored = record; return true; },
  });
  assert.equal(result.accepted, true);
  assert.equal(stored.devicePseudonym.length, 64);
  assert.equal('publicKeyBase64' in stored, false);
  assert.equal('message' in stored, false);
  assert.equal(evaluateCloudDeadMan(stored, NOW).state, 'FRESH');
});

test('L4 fails closed without an app-attestation verifier', async () => {
  await assert.rejects(() => handleGuardianHeartbeat({
    proof: signedProof(),
    nowMs: NOW,
    pseudonymKey: PSEUDONYM_KEY,
    store: async () => true,
  }), /APP_ATTESTATION_VERIFIER_NOT_CONFIGURED/);
});

test('L4 rejects invalid app integrity even when the witness signature is valid', async () => {
  await assert.rejects(() => handleGuardianHeartbeat({
    proof: signedProof(),
    nowMs: NOW,
    pseudonymKey: PSEUDONYM_KEY,
    attestationVerifier: async () => ({ ok: true, packageName: 'ai.laneriq.antiscam', appIntegrityVerified: false }),
    store: async () => true,
  }), /APP_INTEGRITY_NOT_VERIFIED/);
});

test('L4 rejects private/unknown heartbeat fields rather than silently collecting them', async () => {
  const proof = signedProof();
  proof.payload.messageBody = 'private message must never be accepted';
  await assert.rejects(() => handleGuardianHeartbeat({
    proof,
    nowMs: NOW,
    pseudonymKey: PSEUDONYM_KEY,
    attestationVerifier: goodAttestation,
    store: async () => true,
  }), /GUARDIAN_PAYLOAD_FORBIDDEN_FIELDS/);
});

test('L4 Cloud Dead-Man distinguishes stale verification from verified fresh protection', () => {
  const record = {
    schema: 1,
    observedAtMs: NOW - 6 * 60 * 1000,
    leaseExpiresAtMs: NOW + 60_000,
    integrityState: 'ACTIVE_VERIFIED',
    emergencyLevel: 'NONE',
  };
  assert.equal(evaluateCloudDeadMan(record, NOW).state, 'VERIFICATION_UNAVAILABLE');
});
