import test from 'node:test';
import assert from 'node:assert/strict';

import { verifySignedWebEvidence } from '../web-reputation-evidence.mjs';
import { evaluateWebRisk, WebDecision } from '../web-loss-prevention.mjs';
import { signedWebEvidence } from './test-crypto.mjs';

function payload(now = 1_000_000) {
  return {
    evidenceId: 'web-e1',
    sourceType: 'trusted_reputation',
    domainHash: 'e'.repeat(64),
    verdict: 'MALICIOUS',
    issuedAtMs: now - 1_000,
    expiresAtMs: now + 60_000,
  };
}

test('signed malicious web evidence supports known-malicious block claim', () => {
  const now = 1_000_000;
  const bundle = signedWebEvidence(payload(now));
  const verified = verifySignedWebEvidence({ ...bundle, nowMs: now });
  const result = evaluateWebRisk({ webEvidence: verified });
  assert.equal(verified.verified, true);
  assert.equal(result.decision, WebDecision.BLOCK);
  assert.equal(result.knownMaliciousClaimAllowed, true);
});

test('tampered signed web evidence loses trusted claim', () => {
  const now = 1_000_000;
  const bundle = signedWebEvidence(payload(now));
  bundle.payload.domainHash = 'f'.repeat(64);
  const verified = verifySignedWebEvidence({ ...bundle, nowMs: now });
  assert.equal(verified.verified, false);
  const result = evaluateWebRisk({ webEvidence: verified });
  assert.equal(result.knownMaliciousClaimAllowed, false);
});

test('expired web evidence is rejected', () => {
  const now = 1_000_000;
  const expired = { ...payload(now), issuedAtMs: now - 100_000, expiresAtMs: now - 1 };
  const bundle = signedWebEvidence(expired);
  const verified = verifySignedWebEvidence({ ...bundle, nowMs: now });
  assert.equal(verified.verified, false);
  assert.equal(verified.reason, 'expired_evidence');
});

test('unknown web reputation source is rejected even with valid signature', () => {
  const now = 1_000_000;
  const untrusted = { ...payload(now), sourceType: 'random_client' };
  const bundle = signedWebEvidence(untrusted);
  const verified = verifySignedWebEvidence({ ...bundle, nowMs: now });
  assert.equal(verified.verified, false);
  assert.equal(verified.reason, 'untrusted_source_type');
});

test('signed HIGH_RISK evidence blocks without claiming known malicious', () => {
  const now = 1_000_000;
  const highRisk = { ...payload(now), verdict: 'HIGH_RISK' };
  const bundle = signedWebEvidence(highRisk);
  const verified = verifySignedWebEvidence({ ...bundle, nowMs: now });
  const result = evaluateWebRisk({ webEvidence: verified });
  assert.equal(result.decision, WebDecision.BLOCK);
  assert.equal(result.knownMaliciousClaimAllowed, false);
});
