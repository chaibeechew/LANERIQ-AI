import { clamp01 } from './contracts.mjs';

export const AppRiskVerdict = Object.freeze({
  KNOWN_MALICIOUS: 'KNOWN_MALICIOUS',
  HIGH_RISK: 'HIGH_RISK',
  REVIEW: 'REVIEW',
  LOW_OBSERVED_RISK: 'LOW_OBSERVED_RISK',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Evidence-based app/APK risk assessment. Metadata risk alone never becomes a
 * virus verdict. KNOWN_MALICIOUS requires dedicated evidence such as a trusted
 * malware-hash/reputation hit or validated scanner evidence.
 */
export function assessAppRisk({
  knownMalwareHash = false,
  trustedScannerMalicious = false,
  signatureMismatch = false,
  unknownInstaller = false,
  dangerousPermissionScore = 0,
  accessibilityService = false,
  overlayPermission = false,
  deviceAdmin = false,
  remoteControlCapability = false,
  sideloaded = false,
  reputationRisk = 0,
} = {}) {
  if (knownMalwareHash || trustedScannerMalicious) {
    return {
      verdict: AppRiskVerdict.KNOWN_MALICIOUS,
      riskScore: 1,
      virusClaimAllowed: true,
      reason: knownMalwareHash ? 'known_malware_hash' : 'trusted_scanner_malicious_evidence',
    };
  }

  let score = clamp01(reputationRisk);
  score += clamp01(dangerousPermissionScore) * 0.25;
  if (signatureMismatch) score += 0.30;
  if (unknownInstaller) score += 0.12;
  if (accessibilityService) score += 0.18;
  if (overlayPermission) score += 0.16;
  if (deviceAdmin) score += 0.15;
  if (remoteControlCapability) score += 0.25;
  if (sideloaded) score += 0.10;
  score = clamp01(score);

  if (score >= 0.75) {
    return {
      verdict: AppRiskVerdict.HIGH_RISK,
      riskScore: score,
      virusClaimAllowed: false,
      reason: 'multiple_high_risk_app_signals',
    };
  }
  if (score >= 0.35) {
    return {
      verdict: AppRiskVerdict.REVIEW,
      riskScore: score,
      virusClaimAllowed: false,
      reason: 'app_risk_signals_require_review',
    };
  }
  return {
    verdict: AppRiskVerdict.LOW_OBSERVED_RISK,
    riskScore: score,
    virusClaimAllowed: false,
    reason: 'no_high_risk_signal_found_in_available_evidence',
  };
}

export function appScanTruth({ platform = 'android', hasPackageBytes = false, hasHash = false, hasReputation = false } = {}) {
  return Object.freeze({
    platform,
    deepBinaryScanAvailable: Boolean(hasPackageBytes),
    hashEvidenceAvailable: Boolean(hasHash),
    reputationEvidenceAvailable: Boolean(hasReputation),
    mayClaimVirusFree: false,
    note: 'Absence of detected risk is not proof that an app is virus-free.',
  });
}
