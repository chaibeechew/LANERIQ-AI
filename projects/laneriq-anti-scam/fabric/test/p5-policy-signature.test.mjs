import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { canonicalPolicyPayload, verifyEd25519Policy } from '../p5-policy-signature.mjs';
import { RolloutController } from '../p5-rollout-control.mjs';

function signedFixture(payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const message = Buffer.from(canonicalPolicyPayload(payload), 'utf8');
  const signatureBase64 = sign(null, message, privateKey).toString('base64');
  return { publicKeyPem, signatureBase64 };
}

test('P5 Ed25519 policy verifier accepts canonical signed payload', () => {
  const payload = { engine: 'scam-correlation', version: 3, thresholds: { high: 0.8, review: 0.4 } };
  const fixture = signedFixture(payload);
  assert.equal(verifyEd25519Policy({ payload, ...fixture }), true);
});

test('P5 Ed25519 policy verifier rejects tampered payload', () => {
  const original = { engine: 'scam-correlation', version: 3, threshold: 0.8 };
  const fixture = signedFixture(original);
  const tampered = { ...original, threshold: 0.1 };
  assert.equal(verifyEd25519Policy({ payload: tampered, ...fixture }), false);
});

test('P5 RolloutController creates policy only from a valid signature in signed path', () => {
  const payload = { id: 'rule-a', version: 'v1', action: 'review' };
  const fixture = signedFixture(payload);
  const rollout = new RolloutController();
  const created = rollout.createSignedPolicy({ id: 'rule-a', version: 'v1', payload, ...fixture });
  assert.equal(created.rolloutFraction, 0.01);

  assert.throws(() => rollout.createSignedPolicy({
    id: 'rule-b', version: 'v1', payload: { ...payload, action: 'block' }, ...fixture,
  }));
});
