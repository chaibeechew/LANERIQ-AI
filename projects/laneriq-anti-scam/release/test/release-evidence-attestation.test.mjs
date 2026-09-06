import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { canonicalPolicyPayload } from '../../fabric/p5-policy-signature.mjs';
import {
  trustedReleaseEvidenceKeyCount,
  verifyPinnedReleaseEvidence,
} from '../release-evidence-attestation.mjs';

test('release trust store starts empty so no external production evidence is implicitly trusted', () => {
  assert.equal(trustedReleaseEvidenceKeyCount(), 0);
});

test('arbitrary self-signed evidence cannot become a trusted launch token', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const payload = {
    gateId: 'L1.real_system_web_shield',
    status: 'PASS',
    proofRef: 'local-test-only',
    verifierId: 'attacker-key',
    measuredAtMs: Date.now(),
  };
  const signatureBase64 = sign(
    null,
    Buffer.from(canonicalPolicyPayload(payload), 'utf8'),
    privateKey,
  ).toString('base64');

  const token = verifyPinnedReleaseEvidence({ payload, signatureBase64 });
  assert.equal(token, null);
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
