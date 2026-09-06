import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { canonicalPolicyPayload } from '../../fabric/p5-policy-signature.mjs';
import {
  trustedReleaseEvidenceKeyCount,
  verifyPinnedReleaseEvidence,
} from '../release-evidence-attestation.mjs';

const RELEASE_DIGEST = 'a'.repeat(64);

test('release trust store starts empty so no external production evidence is implicitly trusted', () => {
  assert.equal(trustedReleaseEvidenceKeyCount(), 0);
});

test('arbitrary self-signed evidence cannot become a trusted launch token even with a valid source binding', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const payload = {
    gateId: 'L1.real_system_web_shield',
    status: 'PASS',
    proofRef: 'local-test-only',
    verifierId: 'attacker-key',
    releaseSourceDigestSha256: RELEASE_DIGEST,
    measuredAtMs: Date.now(),
  };
  const signatureBase64 = sign(
    null,
    Buffer.from(canonicalPolicyPayload(payload), 'utf8'),
    privateKey,
  ).toString('base64');

  const token = verifyPinnedReleaseEvidence({
    payload,
    signatureBase64,
    expectedReleaseSourceDigestSha256: RELEASE_DIGEST,
  });
  assert.equal(token, null);
});

test('release evidence without a valid current source digest fails closed before readiness', () => {
  const payload = {
    gateId: 'L1.real_system_web_shield',
    status: 'PASS',
    proofRef: 'immutable-proof',
    verifierId: 'nobody',
    releaseSourceDigestSha256: 'not-a-digest',
    measuredAtMs: Date.now(),
  };
  assert.equal(verifyPinnedReleaseEvidence({
    payload,
    signatureBase64: 'AA==',
    expectedReleaseSourceDigestSha256: RELEASE_DIGEST,
  }), null);
});

test('bare boolean fields never satisfy signed public production evidence gates', async () => {
  const { evaluateFiveLayerReadiness } = await import('../release-readiness.mjs');
  const result = evaluateFiveLayerReadiness({
    androidTargetApi36: true,
    productionApplicationId: true,
    realSystemWebShield: true,
    vpnConsentFlowVerified: true,
    vpnIpv4Ipv6HandoffVerified: true,
    signedThreatReputationInAndroid: true,
    webFalsePositiveBenchmarkPassed: true,
  });
  assert.equal(result.layers[0].ready, false);
  assert.ok(result.layers[0].missing.includes('realSystemWebShield'));
});
