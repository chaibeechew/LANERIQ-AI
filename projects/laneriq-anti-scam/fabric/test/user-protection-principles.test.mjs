import test from 'node:test';
import assert from 'node:assert/strict';

import { privacyTruth, validatePrivacyEnvelope } from '../privacy-first-policy.mjs';
import { WebDecision, evaluateWebRisk, shouldFailClosedForSensitiveAction } from '../web-loss-prevention.mjs';
import { AppRiskVerdict, assessAppRisk, appScanTruth } from '../app-risk-scanner.mjs';
import { verifySignedMalwareEvidence } from '../malware-evidence.mjs';
import { RemoteControlRisk, evaluateRemoteControlRisk, remoteControlTruth } from '../anti-remote-control.mjs';
import { signedMalwareEvidence } from './test-crypto.mjs';

test('Privacy First: default product mode forbids remote monitoring and raw private content upload', () => {
  const truth = privacyTruth();
  assert.equal(truth.rawPrivateContentUploadByDefault, false);
  assert.equal(truth.remoteMonitoringByDefault, false);
  assert.equal(truth.crossUserComputeOnMobile, false);
});

test('Privacy First: cloud envelope fails closed when raw private fields appear', () => {
  const validation = validatePrivacyEnvelope({
    schemaVersion: 1,
    eventId: 'e1',
    devicePseudonym: 'p1',
    type: 'risk',
    occurredAtMs: 1,
    risk: 'REVIEW',
    threatFingerprint: 'x',
    source: 'guardian',
    regionHint: 'sea',
    evidenceCount: 1,
    messageBody: 'private',
  });
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.forbidden, ['messageBody']);
});

test('Web protection: known malicious destination is blocked before navigation', () => {
  const result = evaluateWebRisk({ knownMalicious: true });
  assert.equal(result.decision, WebDecision.BLOCK);
  assert.equal(result.riskScore, 1);
});

test('Web protection: sensitive remote-control context raises block decision', () => {
  const result = evaluateWebRisk({
    localHeuristicRisk: 0.45,
    paymentContext: true,
    remoteControlRisk: true,
  });
  assert.equal(result.decision, WebDecision.BLOCK);
  assert.equal(shouldFailClosedForSensitiveAction(result, { paymentContext: true }), true);
});

test('Web protection: low observed risk never becomes a safety guarantee', () => {
  const result = evaluateWebRisk({ localHeuristicRisk: 0.05 });
  assert.equal(result.decision, WebDecision.ALLOW);
  assert.match(result.claim, /not a guarantee/i);
});

test('App scanner: only verified signed malware evidence may support a malicious verdict', () => {
  const now = 1_000_000;
  const bundle = signedMalwareEvidence({
    evidenceId: 'mal-1',
    sourceType: 'scanner',
    indicatorType: 'apk_sha256',
    indicatorHash: 'a'.repeat(64),
    verdict: 'MALICIOUS',
    issuedAtMs: now - 10_000,
    expiresAtMs: now + 60_000,
  });
  const verified = verifySignedMalwareEvidence({ ...bundle, nowMs: now });
  const result = assessAppRisk({ malwareEvidence: verified });
  assert.equal(result.verdict, AppRiskVerdict.KNOWN_MALICIOUS);
  assert.equal(result.malwareClaimAllowed, true);
  assert.equal(result.virusClaimAllowed, false);
});

test('App scanner: forged malware-like object cannot create malicious verdict', () => {
  const result = assessAppRisk({
    malwareEvidence: { verified: true, malicious: true, evidenceId: 'forged' },
  });
  assert.notEqual(result.verdict, AppRiskVerdict.KNOWN_MALICIOUS);
  assert.equal(result.malwareClaimAllowed, false);
});

test('App scanner: risky permissions and remote-control capability do not by themselves become a malware claim', () => {
  const result = assessAppRisk({
    dangerousPermissionScore: 1,
    accessibilityService: true,
    overlayPermission: true,
    remoteControlCapability: true,
    sideloaded: true,
  });
  assert.ok([AppRiskVerdict.HIGH_RISK, AppRiskVerdict.REVIEW].includes(result.verdict));
  assert.equal(result.malwareClaimAllowed, false);
  assert.equal(result.virusClaimAllowed, false);
});

test('App scanner truth never claims malware-free or virus-free from incomplete Android/iOS evidence', () => {
  const truth = appScanTruth({ platform: 'android', hasHash: true, hasReputation: true });
  assert.equal(truth.mayClaimMalwareFree, false);
  assert.equal(truth.mayClaimVirusFree, false);
});

test('Anti-remote-control: correlated sensitive-context signals trigger critical interruption guidance', () => {
  const result = evaluateRemoteControlRisk({
    unknownAccessibilityService: true,
    overlayActive: true,
    screenShareActive: true,
    remoteSupportAppActive: true,
    bankingContext: true,
    recentUnknownInstall: true,
  });
  assert.equal(result.risk, RemoteControlRisk.CRITICAL);
  assert.equal(result.shouldBlockSensitiveLaneriqAction, true);
  assert.equal(result.shouldShowUrgentDisconnectGuidance, true);
  assert.equal(result.privateContentInspected, false);
});

test('Anti-remote-control truth refuses absolute impossible-to-control claim', () => {
  const truth = remoteControlTruth();
  assert.equal(truth.absolutePreventionGuaranteed, false);
  assert.equal(truth.privateContentMonitoringRequired, false);
});
