import test from 'node:test';
import assert from 'node:assert/strict';

import { EvidenceRevocationPolicy } from '../evidence-revocation.mjs';
import { verifySignedMalwareEvidence } from '../malware-evidence.mjs';
import { AppRiskVerdict, assessAppRisk } from '../app-risk-scanner.mjs';
import { verifySignedWebEvidence } from '../web-reputation-evidence.mjs';
import { WebDecision, evaluateWebRisk } from '../web-loss-prevention.mjs';
import { signedMalwareEvidence, signedWebEvidence } from './test-crypto.mjs';

const NOW = 1_000_000;

function malwarePayload(overrides = {}) {
  return {
    evidenceId: 'mal-rev-1',
    sourceType: 'scanner',
    indicatorType: 'apk_sha256',
    indicatorHash: 'a'.repeat(64),
    verdict: 'MALICIOUS',
    issuedAtMs: NOW - 1_000,
    expiresAtMs: NOW + 60_000,
    ...overrides,
  };
}

function webPayload(overrides = {}) {
  return {
    evidenceId: 'web-rev-1',
    sourceType: 'phishing_feed',
    domainHash: 'b'.repeat(64),
    verdict: 'MALICIOUS',
    issuedAtMs: NOW - 1_000,
    expiresAtMs: NOW + 60_000,
    ...overrides,
  };
}

test('revoked malware evidence immediately loses malicious-claim authority', () => {
  const signed = signedMalwareEvidence(malwarePayload());
  const evidence = verifySignedMalwareEvidence({ ...signed, nowMs: NOW });
  assert.equal(assessAppRisk({ malwareEvidence: evidence }).verdict, AppRiskVerdict.KNOWN_MALICIOUS);

  const revocations = new EvidenceRevocationPolicy({ revokedEvidenceIds: [evidence.evidenceId] });
  const result = assessAppRisk({ malwareEvidence: evidence, evidenceRevocations: revocations });
  assert.notEqual(result.verdict, AppRiskVerdict.KNOWN_MALICIOUS);
  assert.equal(result.malwareClaimAllowed, false);
  assert.equal(result.reason, 'malware_evidence_revoked');
});

test('revoking a malware source disables all evidence from that source', () => {
  const signed = signedMalwareEvidence(malwarePayload({ evidenceId: 'mal-source' }));
  const evidence = verifySignedMalwareEvidence({ ...signed, nowMs: NOW });
  const revocations = new EvidenceRevocationPolicy({ revokedSourceTypes: ['scanner'] });
  assert.notEqual(
    assessAppRisk({ malwareEvidence: evidence, evidenceRevocations: revocations }).verdict,
    AppRiskVerdict.KNOWN_MALICIOUS,
  );
});

test('revoked web evidence cannot retain known-malicious claim', () => {
  const signed = signedWebEvidence(webPayload());
  const evidence = verifySignedWebEvidence({ ...signed, nowMs: NOW });
  assert.equal(evaluateWebRisk({ webEvidence: evidence }).knownMaliciousClaimAllowed, true);

  const revocations = new EvidenceRevocationPolicy({ revokedEvidenceIds: [evidence.evidenceId] });
  const result = evaluateWebRisk({ webEvidence: evidence, evidenceRevocations: revocations });
  assert.equal(result.knownMaliciousClaimAllowed, false);
  assert.notEqual(result.reason, 'verified_known_malicious_destination');
});

test('web evidence TTL is bounded even when signature is valid', () => {
  const tooLong = webPayload({
    issuedAtMs: NOW - 1_000,
    expiresAtMs: NOW + (48 * 60 * 60_000),
  });
  const signed = signedWebEvidence(tooLong);
  const result = verifySignedWebEvidence({ ...signed, nowMs: NOW });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'evidence_ttl_too_long');
});

test('malware evidence TTL is bounded even when signature is valid', () => {
  const tooLong = malwarePayload({
    issuedAtMs: NOW - 1_000,
    expiresAtMs: NOW + (31 * 24 * 60 * 60_000),
  });
  const signed = signedMalwareEvidence(tooLong);
  const result = verifySignedMalwareEvidence({ ...signed, nowMs: NOW });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'evidence_ttl_too_long');
});

test('high heuristic web risk may interrupt navigation without claiming known malicious', () => {
  const result = evaluateWebRisk({ localHeuristicRisk: 0.95 });
  assert.equal(result.decision, WebDecision.BLOCK);
  assert.equal(result.knownMaliciousClaimAllowed, false);
});
