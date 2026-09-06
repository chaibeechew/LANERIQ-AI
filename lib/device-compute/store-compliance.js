export const MOTHER_AI_COMPUTE_DISCLOSURE_VERSION = "2026-09-05.3";

function text(value) { return String(value || "").trim().toLowerCase(); }

export function classifyDistribution(input = {}) {
  const ua = String(input.userAgent || "");
  const nativePlatform = text(input.nativePlatform);
  const channel = text(input.distributionChannel);
  const ios = nativePlatform === "ios" || nativePlatform === "ipados" || /iphone|ipad/i.test(ua);
  const android = nativePlatform === "android" || /android/i.test(ua);
  const desktop = ["macos","windows","linux"].includes(nativePlatform) || (!ios && !android && /macintosh|windows nt|linux/i.test(ua));
  const appStore = channel === "app_store" || channel === "apple_app_store";
  const googlePlay = channel === "google_play" || channel === "play_store";
  return Object.freeze({ ios, android, desktop, appStore, googlePlay, mobileStoreBuild: (ios && appStore) || (android && googlePlay) });
}

export function evaluateComputePrivacyAdmission(input = {}) {
  const purpose = input.purpose === "community_compute" ? "community_compute" : "personal_compute";
  const privacyClass = text(input.privacyClass || "unknown");
  const consent = input.explicitConsent === true;
  const withdrawn = input.consentWithdrawn === true;
  const crossBorder = input.crossBorderTransfer === true;
  const crossBorderReviewed = input.crossBorderReviewed === true;
  const dpiaApproved = input.dpiaApproved === true;
  const sensitive = ["sensitive","highly_sensitive","p4","red"].includes(privacyClass);
  const community = purpose === "community_compute";

  if (!consent || withdrawn) return Object.freeze({ allowed: false, reason: withdrawn ? "consent_withdrawn" : "explicit_consent_required" });
  if (community && sensitive) return Object.freeze({ allowed: false, reason: "sensitive_community_workload_blocked" });
  if (community && !dpiaApproved) return Object.freeze({ allowed: false, reason: "community_compute_dpia_required" });
  if (crossBorder && !crossBorderReviewed) return Object.freeze({ allowed: false, reason: "cross_border_review_required" });

  return Object.freeze({
    allowed: true,
    reason: "privacy_admitted",
    dataMinimizationRequired: true,
    purposeLimitationRequired: true,
    retentionMinimizationRequired: true,
    consentReceiptRequired: true,
    withdrawalMustStopFutureOptionalCompute: true,
    dpiaRequiredForCommunityCompute: community,
    crossBorderReviewRequired: crossBorder,
    dpoApplicabilityAssessmentRequired: true,
    breachResponseRequired: true,
    sensitiveCommunityWorkloadsAllowed: false,
  });
}

export function computeStoreCompliance(input = {}) {
  const distribution = classifyDistribution(input);
  const lowPowerMode = input.lowPowerMode === true;
  const thermalState = text(input.thermalState || "unknown");
  const foreground = input.visibility !== "hidden";
  const userInitiatedTask = input.userInitiatedTask !== false;

  const personalComputeAllowed = userInitiatedTask && !["serious","critical"].includes(thermalState) && !lowPowerMode;
  const backgroundPersonalComputeAllowed = distribution.ios
    ? Boolean(input.systemScheduledBackgroundTask === true && userInitiatedTask && !lowPowerMode && !["fair","serious","critical"].includes(thermalState))
    : distribution.android
      ? Boolean(input.systemManagedBackgroundWork === true && userInitiatedTask && !lowPowerMode && !["serious","critical"].includes(thermalState))
      : true;

  // Mobile devices are Personal Compute only. Community Compute is a future
  // Desktop capability so a missing/incorrect store-channel signal cannot open it.
  const communityComputePreferenceOffered = distribution.desktop && !distribution.ios && !distribution.android;
  const communityComputeExecutionAllowed = false;

  return Object.freeze({
    disclosureVersion: MOTHER_AI_COMPUTE_DISCLOSURE_VERSION,
    distribution,
    personalComputeAllowed,
    foregroundPersonalComputePreferred: true,
    backgroundPersonalComputeAllowed,
    communityComputePreferenceOffered,
    communityComputeExecutionAllowed,
    unrelatedBackgroundComputeAllowed: false,
    bypassSystemPowerManagementAllowed: false,
    downloadedExecutableWorkloadsAllowed: false,
    privateContentPermissionImpliedByComputeConsent: false,
    prominentDisclosureRequired: true,
    affirmativeConsentRequired: true,
    consentWithdrawalRequired: true,
    privacyNoticeRequired: true,
    dataMinimizationRequired: true,
    purposeLimitationRequired: true,
    retentionMinimizationRequired: true,
    dpiaRequiredBeforeCommunityProduction: true,
    crossBorderReviewRequiredBeforeCrossBorderCommunityRouting: true,
    dpoApplicabilityAssessmentRequired: true,
    sensitiveCommunityWorkloadsAllowed: false,
    reason: distribution.ios || distribution.android
      ? "mobile_personal_compute_only"
      : foreground ? "personal_compute_store_safe" : "background_requires_platform_controls",
  });
}

export function buildComputeConsentReceipt(input = {}) {
  const now = typeof input.timestamp === "string" && input.timestamp ? input.timestamp : new Date().toISOString();
  const purpose = input.purpose === "community_compute" ? "community_compute" : "personal_compute";
  const maxResourceShare = Math.max(0, Math.min(0.05, Number(input.maxResourceShare || 0)));
  return Object.freeze({
    receiptVersion: "mother-ai-compute-consent-v1",
    disclosureVersion: MOTHER_AI_COMPUTE_DISCLOSURE_VERSION,
    purpose,
    affirmativeAction: true,
    timestamp: now,
    withdrawnAt: null,
    platformClass: text(input.platformClass || "unknown"),
    distributionChannel: text(input.distributionChannel || "unknown"),
    mode: text(input.mode || "balanced"),
    maxResourceShare,
    backgroundCompute: input.backgroundCompute === true,
    communityCompute: purpose === "community_compute",
    privateContentPermissionGranted: false,
    advertisingTrackingConsentGranted: false,
    unrelatedDataUseConsentGranted: false,
  });
}

export function publicMotherAiComputeCompliancePolicy() {
  return Object.freeze({
    version: MOTHER_AI_COMPUTE_DISCLOSURE_VERSION,
    mobileCommunityCompute: false,
    appStoreMobileCommunityCompute: false,
    googlePlayMobileCommunityCompute: false,
    desktopCommunityComputeFutureOnly: true,
    personalComputeMustServeUserRequestedLaneriqFunctionality: true,
    unrelatedBackgroundComputeAllowed: false,
    systemPowerManagementMustBeRespected: true,
    prominentDisclosureRequired: true,
    affirmativeConsentRequired: true,
    separateCommunityConsentRequired: true,
    withdrawalRequired: true,
    computeConsentDoesNotGrantPrivateContentAccess: true,
    dataMinimizationRequired: true,
    purposeLimitationRequired: true,
    retentionMinimizationRequired: true,
    sensitiveCommunityWorkloadsAllowed: false,
    communityComputeDpiaRequired: true,
    crossBorderReviewRequired: true,
    dpoApplicabilityAssessmentRequired: true,
    qualifiedLegalReviewRequiredBeforeProductionCommunityCompute: true,
  });
}
