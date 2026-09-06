import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

import {
  canonicalWitnessProofPayload,
  verifyWitnessCryptoProof,
  WitnessKeyContinuity,
  WitnessKeyState,
} from '../p0_5-witness-crypto-proof.mjs';

function makeProof(payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const canonical = canonicalWitnessProofPayload(payload);
  const signature = sign('sha256', Buffer.from(canonical, 'utf8'), privateKey);
  return {
    publicKeyBase64: publicDer.toString('base64'),
    signatureBase64: signature.toString('base64'),
    keyIdSha256: createHash('sha256').update(publicDer).digest('hex'),
  };
}

const payload = Object.freeze({
  packageName: 'ai.laneriq.antiscam.test',
  leaseEpoch: 9,
  heartbeatSequence: 22,
  leaseExpiresAtMs: 2_000_000,
  integrityState: 'ACTIVE',
  emergencyLevel: 'NONE',
  alertDeliveryState: 'AVAILABLE',
  policyVersion: 'p0.5-survival-1',
  observedAtMs: 1_999_000,
  schemaVersion: 1,
});

test('P0.5 companion verifies valid P-256 Witness proof', () => {
  const proof = makeProof(payload);
  const result = verifyWitnessCryptoProof({ payload, ...proof });
  assert.equal(result.verified, true);
  assert.equal(result.keyIdSha256, proof.keyIdSha256);
});

test('P0.5 tampered Witness payload fails signature verification', () => {
  const proof = makeProof(payload);
  const result = verifyWitnessCryptoProof({
    payload: { ...payload, heartbeatSequence: 999 },
    ...proof,
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'signature_invalid');
});

test('P0.5 mismatched key id fails before trust', () => {
  const proof = makeProof(payload);
  const result = verifyWitnessCryptoProof({
    payload,
    ...proof,
    keyIdSha256: '0'.repeat(64),
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'key_id_mismatch');
});

test('P0.5 Witness key is not auto-enrolled without package-signature trust', () => {
  const proof = makeProof(payload);
  const continuity = new WitnessKeyContinuity();
  const before = continuity.status('anti-scam-local', proof.keyIdSha256);
  assert.equal(before.state, WitnessKeyState.UNENROLLED);
  assert.equal(before.trusted, false);
  assert.throws(
    () => continuity.enroll('anti-scam-local', proof.keyIdSha256),
    /package signature trust required/,
  );
});

test('P0.5 trusted enrollment pins key and detects unexpected replacement', () => {
  const first = makeProof(payload);
  const second = makeProof(payload);
  const continuity = new WitnessKeyContinuity();
  const enrolled = continuity.enroll(
    'anti-scam-local',
    first.keyIdSha256,
    { packageSignatureTrustVerified: true },
  );
  assert.equal(enrolled.state, WitnessKeyState.VERIFIED);
  assert.equal(enrolled.trusted, true);

  const changed = continuity.status('anti-scam-local', second.keyIdSha256);
  assert.equal(changed.state, WitnessKeyState.KEY_CHANGED_REENROLL_REQUIRED);
  assert.equal(changed.trusted, false);
});
