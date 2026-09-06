import { clamp01 } from './contracts.mjs';
import { isVerifiedMalwareEvidence } from './malware-evidence.mjs';
import { evidenceUsable } from './evidence-revocation.mjs';

export const AppRiskVerdict = Object.freeze({
  KNOWN_MALICIOUS: 'KNOWN_MALICIOUS',
  HIGH_RISK: 'HIGH_RISK',
  REVIEW: 'REVIEW',
  LOW_OBSERVED_RISK: 'LOW_OBSERVED_RISK',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Evidence-based app/APK risk assessment.
 *
 * Critical truth boundary:
 * - metadata/permission/remote-control risk can never create a malware verdict
 * - KNOWN_MALICIOUS requires a verified signed malware-evidence token that is not revoked
 * - a generic malware verdict is not automatically a specific "virus" classification
 */
export function assessAppRisk({
  malwareEvidence = null,
  evidenceRevocations = null,
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
  if (isVerifiedMalwareEvidence(malwareEvidence) && evidenceUsable(malwareEvidence, evidenceRevocations)) {
    return {
      verdict: AppRiskVerdict.KNOWN_MALICIOUS,
      riskScore: 1,
      malwareClaimAllowed: true,
      virusClaimAllowed: false,
      reason: 'verified_signed_malware_evidence',
      evidenceId: malwareEvidence.evidenceId,
      evidenceSourceType: malwareEvidence.sourceType,
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
      malwareClaimAllowed: false,
      virusClaimAllowed: false,
      reason: 'multiple_high_risk_app_signals',
    };
  }
  if (score >= 0.35) {
    return {
      verdict: AppRiskVerdict.REVIEW,
      riskScore: score,
      malwareClaimAllowed: false,
      virusClaimAllowed: false,
      reason: 'app_risk_signals_require_review',
    };
  }
  return {
    verdict: AppRiskVerdict.LOW_OBSERVED_RISK,
    riskScore: score,
    malwareClaimAllowed: false,
    virusClaimAllowed: false,
    reason: malwareEvidence && evidenceRevocations?.isRevoked?.(malwareEvidence)
      ? 'malware_evidence_revoked'
      : 'no_high_risk_signal_found_in_available_evidence',
  };
}

export function appScanTruth({ platform = 'android', hasPackageBytes = false, hasHash = false, hasReputation = false } = {}) {
  return Object.freeze({
    platform,
    deepBinaryScanAvailable: Boolean(hasPackageBytes),
    hashEvidenceAvailable: Boolean(hasHash),
    reputationEvidenceAvailable: Boolean(hasReputation),
    mayClaimMalwareFree: false,
    mayClaimVirusFree: false,
    note: 'Absence of detected risk is not proof that an app is malware-free or virus-free.',
  });
}
