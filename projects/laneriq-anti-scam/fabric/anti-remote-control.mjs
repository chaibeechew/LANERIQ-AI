import { clamp01 } from './contracts.mjs';

export const RemoteControlRisk = Object.freeze({
  LOW: 'LOW',
  REVIEW: 'REVIEW',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

/**
 * Local technical-risk correlation only. This does not inspect messages,
 * microphone audio, photos, or screen contents.
 */
export function evaluateRemoteControlRisk({
  unknownAccessibilityService = false,
  overlayActive = false,
  screenShareActive = false,
  remoteSupportAppActive = false,
  adbEnabled = false,
  deviceAdminChanged = false,
  bankingContext = false,
  paymentContext = false,
  recentUnknownInstall = false,
} = {}) {
  let score = 0;
  if (unknownAccessibilityService) score += 0.28;
  if (overlayActive) score += 0.22;
  if (screenShareActive) score += 0.28;
  if (remoteSupportAppActive) score += 0.24;
  if (adbEnabled) score += 0.10;
  if (deviceAdminChanged) score += 0.18;
  if (recentUnknownInstall) score += 0.18;
  if ((bankingContext || paymentContext) && (screenShareActive || remoteSupportAppActive || unknownAccessibilityService)) score += 0.30;
  score = clamp01(score);

  let risk = RemoteControlRisk.LOW;
  if (score >= 0.85) risk = RemoteControlRisk.CRITICAL;
  else if (score >= 0.60) risk = RemoteControlRisk.HIGH;
  else if (score >= 0.30) risk = RemoteControlRisk.REVIEW;

  return {
    risk,
    riskScore: score,
    shouldBlockSensitiveLaneriqAction: (bankingContext || paymentContext) && (risk === RemoteControlRisk.HIGH || risk === RemoteControlRisk.CRITICAL),
    shouldShowUrgentDisconnectGuidance: risk === RemoteControlRisk.CRITICAL,
    privateContentInspected: false,
    guaranteeExternalControlImpossible: false,
    reason: risk === RemoteControlRisk.CRITICAL
      ? 'multiple_remote_control_risk_signals_in_sensitive_context'
      : risk === RemoteControlRisk.HIGH
        ? 'correlated_remote_control_risk_signals'
        : risk === RemoteControlRisk.REVIEW
          ? 'remote_control_signal_requires_review'
          : 'no_high_remote_control_risk_signal_found_in_this_check',
  };
}

export function remoteControlTruth() {
  return Object.freeze({
    absolutePreventionGuaranteed: false,
    localRiskDetectionEnabledByDesign: true,
    privateContentMonitoringRequired: false,
    principle: 'Detect and interrupt risky control paths early without monitoring private user content.',
  });
}
