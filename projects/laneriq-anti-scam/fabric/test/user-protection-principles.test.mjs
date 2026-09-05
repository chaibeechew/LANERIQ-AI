import test from 'node:test';
import assert from 'node:assert/strict';

import { privacyTruth, validatePrivacyEnvelope } from '../privacy-first-policy.mjs';
import { WebDecision, evaluateWebRisk, shouldFailClosedForSensitiveAction } from '../web-loss-prevention.mjs';
import { AppRiskVerdict, assessAppRisk, appScanTruth } from '../app-risk-scanner.mjs';
import { RemoteControlRisk, evaluateRemoteControlRisk, remoteControlTruth } from '../anti-remote-control.mjs';

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

test('App scanner: known malware hash may support a malicious verdict', () => {
  const result = assessAppRisk({ knownMalwareHash: true });
  assert.equal(result.verdict, AppRiskVerdict.KNOWN_MALICIOUS);
  assert.equal(result.virusClaimAllowed, true);
});

test('App scanner: risky permissions and remote-control capability do not by themselves become a virus claim', () => {
  const result = assessAppRisk({
    dangerousPermissionScore: 1,
    accessibilityService: true,
    overlayPermission: true,
    remoteControlCapability: true,
    sideloaded: true,
  });
  assert.ok([AppRiskVerdict.HIGH_RISK, AppRiskVerdict.REVIEW].includes(result.verdict));
  assert.equal(result.virusClaimAllowed, false);
});

test('App scanner truth never claims virus-free from incomplete Android/iOS evidence', () => {
  const truth = appScanTruth({ platform: 'android', hasHash: true, hasReputation: true });
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
