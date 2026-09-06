import { connectivityCapabilities, normalizeConnectivityState } from "../offline/billion-scale-free-ai.js";

export const DEVICE_COMPUTE_POLICY_VERSION = "2026-09-05.4";
export const DEVICE_COMPUTE_STORAGE_KEY = "laneriq.device-compute.v1";
export const DEVICE_COMPUTE_EVENT = "laneriq:device-compute-updated";
export const MAX_ADAPTIVE_COMPUTE_SHARE = 0.05;

export const COMPUTE_MODES = Object.freeze({
  eco: Object.freeze({
    id: "eco",
    label: "Eco",
    description: "Mother AI stays almost invisible and normally keeps extra device compute at about 0–1%.",
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Balanced",
    description: "Mother AI adapts around your activity and can use roughly 1–3% when the device has comfortable headroom.",
  }),
  enhanced: Object.freeze({
    id: "enhanced",
    label: "Enhanced",
    description: "Mother AI may use up to 5% for short eligible work when power, temperature and device activity allow it.",
  }),
});

const DEVICE_BUDGETS = Object.freeze({
  mobile: Object.freeze({
    eco: { sustainedCpuShare: 0.005, sustainedGpuShare: 0.006, burstCpuShare: 0.01, burstGpuShare: 0.01, burstSeconds: 10, recoverySeconds: 30 },
    balanced: { sustainedCpuShare: 0.01, sustainedGpuShare: 0.012, burstCpuShare: 0.03, burstGpuShare: 0.03, burstSeconds: 15, recoverySeconds: 30 },
    enhanced: { sustainedCpuShare: 0.015, sustainedGpuShare: 0.02, burstCpuShare: 0.05, burstGpuShare: 0.05, burstSeconds: 20, recoverySeconds: 40 },
  }),
  tablet: Object.freeze({
    eco: { sustainedCpuShare: 0.007, sustainedGpuShare: 0.008, burstCpuShare: 0.012, burstGpuShare: 0.012, burstSeconds: 12, recoverySeconds: 30 },
    balanced: { sustainedCpuShare: 0.012, sustainedGpuShare: 0.015, burstCpuShare: 0.03, burstGpuShare: 0.03, burstSeconds: 18, recoverySeconds: 30 },
    enhanced: { sustainedCpuShare: 0.02, sustainedGpuShare: 0.025, burstCpuShare: 0.05, burstGpuShare: 0.05, burstSeconds: 24, recoverySeconds: 40 },
  }),
  laptop: Object.freeze({
    eco: { sustainedCpuShare: 0.01, sustainedGpuShare: 0.01, burstCpuShare: 0.015, burstGpuShare: 0.015, burstSeconds: 15, recoverySeconds: 25 },
    balanced: { sustainedCpuShare: 0.015, sustainedGpuShare: 0.02, burstCpuShare: 0.03, burstGpuShare: 0.03, burstSeconds: 24, recoverySeconds: 25 },
    enhanced: { sustainedCpuShare: 0.025, sustainedGpuShare: 0.03, burstCpuShare: 0.05, burstGpuShare: 0.05, burstSeconds: 35, recoverySeconds: 30 },
  }),
  desktop: Object.freeze({
    eco: { sustainedCpuShare: 0.01, sustainedGpuShare: 0.01, burstCpuShare: 0.02, burstGpuShare: 0.02, burstSeconds: 20, recoverySeconds: 20 },
    balanced: { sustainedCpuShare: 0.02, sustainedGpuShare: 0.025, burstCpuShare: 0.04, burstGpuShare: 0.04, burstSeconds: 30, recoverySeconds: 20 },
    enhanced: { sustainedCpuShare: 0.03, sustainedGpuShare: 0.035, burstCpuShare: 0.05, burstGpuShare: 0.05, burstSeconds: 45, recoverySeconds: 25 },
  }),
});

export function normalizeThermalState(value) {
  const state = String(value || "unknown").trim().toLowerCase();
  if (["nominal", "none", "normal", "cool"].includes(state)) return "nominal";
  if (["fair", "light", "warm"].includes(state)) return "fair";
  if (["moderate", "serious", "severe", "hot"].includes(state)) return "serious";
  if (["critical", "emergency", "shutdown"].includes(state)) return "critical";
  return "unknown";
}

export function classifyDevice(input = {}) {
  const ua = String(input.userAgent || "");
  const cores = Math.max(0, Number(input.hardwareConcurrency || 0));
  const memory = Math.max(0, Number(input.deviceMemory || 0));
  const touch = Math.max(0, Number(input.maxTouchPoints || 0));
  const mobile = /iPhone|Android.+Mobile|Windows Phone|Mobile/i.test(ua);
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) || (!mobile && touch > 1 && /Macintosh/i.test(ua));
  if (mobile) return "mobile";
  if (tablet) return "tablet";
  if (/MacBook|Laptop/i.test(ua)) return "laptop";
  if (cores && cores <= 8 && memory && memory <= 8) return "laptop";
  return "desktop";
}

export function createDefaultDeviceComputeSettings() {
  return {
    policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
    decision: null,
    localComputeEnabled: false,
    mode: "balanced",
    keepLocalProjectData: true,
    backgroundComputeEnabled: false,
    ownDesktopRemoteComputeEnabled: false,
    communityComputeEnabled: false,
    communityComputeConsentAt: null,
    crossUserComputeEnabled: false,
    thermalGuardianEnabled: true,
    consentAt: null,
    installationId: null,
  };
}

export function sanitizeDeviceComputeSettings(value = {}) {
  const defaults = createDefaultDeviceComputeSettings();
  const decision = ["local", "cloud_only"].includes(value.decision) ? value.decision : null;
  const localComputeEnabled = decision === "local" && value.localComputeEnabled !== false;
  const mode = Object.prototype.hasOwnProperty.call(COMPUTE_MODES, value.mode) ? value.mode : defaults.mode;
  const communityComputeEnabled = localComputeEnabled && value.communityComputeEnabled === true;
  return {
    ...defaults,
    policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
    decision,
    localComputeEnabled,
    mode,
    keepLocalProjectData: value.keepLocalProjectData !== false,
    backgroundComputeEnabled: localComputeEnabled && value.backgroundComputeEnabled === true,
    ownDesktopRemoteComputeEnabled: value.ownDesktopRemoteComputeEnabled === true,
    communityComputeEnabled,
    communityComputeConsentAt: communityComputeEnabled && typeof value.communityComputeConsentAt === "string" ? value.communityComputeConsentAt : null,
    crossUserComputeEnabled: false,
    thermalGuardianEnabled: true,
    consentAt: typeof value.consentAt === "string" ? value.consentAt : null,
    installationId: typeof value.installationId === "string" && /^[A-Za-z0-9._:-]{8,160}$/.test(value.installationId) ? value.installationId : null,
  };
}

function clampShare(value) {
  return Math.max(0, Math.min(MAX_ADAPTIVE_COMPUTE_SHARE, Number(Number(value || 0).toFixed(4))));
}

function scaleBudget(budget, factor) {
  const scale = (value) => clampShare(value * factor);
  return {
    ...budget,
    sustainedCpuShare: scale(budget.sustainedCpuShare),
    sustainedGpuShare: scale(budget.sustainedGpuShare),
    burstCpuShare: scale(budget.burstCpuShare),
    burstGpuShare: scale(budget.burstGpuShare),
  };
}

function capBudget(budget, cap) {
  const limit = clampShare(cap);
  const apply = (value) => Math.min(clampShare(value), limit);
  return {
    ...budget,
    sustainedCpuShare: apply(budget.sustainedCpuShare),
    sustainedGpuShare: apply(budget.sustainedGpuShare),
    burstCpuShare: apply(budget.burstCpuShare),
    burstGpuShare: apply(budget.burstGpuShare),
  };
}

function zeroBudget(budget) {
  return {
    ...budget,
    sustainedCpuShare: 0,
    sustainedGpuShare: 0,
    burstCpuShare: 0,
    burstGpuShare: 0,
  };
}

function applyUnknownThermalGuard(budget, deviceClass) {
  const cap = deviceClass === "mobile" || deviceClass === "tablet" ? 0.01 : 0.02;
  const guarded = capBudget(scaleBudget(budget, 0.5), cap);
  if (deviceClass === "mobile" || deviceClass === "tablet") {
    guarded.burstSeconds = Math.min(guarded.burstSeconds, 12);
    guarded.recoverySeconds = Math.max(guarded.recoverySeconds, 35);
  }
  return guarded;
}

export function computeDeviceBudget(input = {}) {
  const settings = sanitizeDeviceComputeSettings(input.settings || {});
  const deviceClass = DEVICE_BUDGETS[input.deviceClass] ? input.deviceClass : "mobile";
  const thermalState = normalizeThermalState(input.thermalState);
  const connectivityState = normalizeConnectivityState(input.connectivityState);
  const connectivity = connectivityCapabilities(connectivityState);
  const batteryLevel = Number.isFinite(Number(input.batteryLevel)) ? Math.max(0, Math.min(1, Number(input.batteryLevel))) : null;
  const charging = input.charging === true;
  const visibility = input.visibility === "hidden" ? "hidden" : "visible";
  const cores = Math.max(1, Number(input.hardwareConcurrency || 1));
  let budget = { ...DEVICE_BUDGETS[deviceClass][settings.mode] };
  const ownDesktopReachable = settings.ownDesktopRemoteComputeEnabled && connectivity.localNetworkAvailable;
  const fallbackRoute = () => ownDesktopReachable ? "own_desktop" : connectivity.internetAvailable ? "cloud_fallback" : "offline_queue";
  let route = settings.localComputeEnabled ? "local_device" : fallbackRoute();
  let reason = settings.localComputeEnabled ? "mother_ai_personal_compute_enabled" : connectivity.internetAvailable ? "cloud_only_selected" : ownDesktopReachable ? "same_user_desktop_available" : "offline_local_compute_disabled";

  if (!settings.thermalGuardianEnabled) throw new Error("THERMAL_GUARDIAN_CANNOT_BE_DISABLED");
  if (settings.crossUserComputeEnabled) throw new Error("LEGACY_CROSS_USER_COMPUTE_NOT_ALLOWED");

  if (!settings.localComputeEnabled) {
    budget = zeroBudget(budget);
  } else if (thermalState === "critical") {
    budget = zeroBudget(budget);
    route = fallbackRoute();
    reason = "thermal_critical_paused";
  } else if (thermalState === "serious") {
    budget = zeroBudget(budget);
    route = fallbackRoute();
    reason = "thermal_serious_paused";
  } else if (thermalState === "fair") {
    budget = scaleBudget(budget, 0.5);
    reason = "thermal_fair_throttled";
  } else if (thermalState === "unknown") {
    budget = applyUnknownThermalGuard(budget, deviceClass);
    reason = "thermal_unknown_conservative";
  }

  if (settings.localComputeEnabled && !charging && (deviceClass === "mobile" || deviceClass === "tablet")) {
    budget = capBudget(budget, 0.03);
  }

  if (batteryLevel !== null && batteryLevel < 0.35 && !charging && settings.localComputeEnabled) {
    budget = capBudget(budget, deviceClass === "mobile" || deviceClass === "tablet" ? 0.005 : 0.01);
    reason = "low_battery_throttled";
  }

  if (batteryLevel !== null && batteryLevel < 0.2 && !charging && settings.localComputeEnabled && (deviceClass === "mobile" || deviceClass === "tablet")) {
    budget = zeroBudget(budget);
    route = fallbackRoute();
    reason = "low_battery_paused";
  }

  if (visibility === "hidden" && !settings.backgroundComputeEnabled && settings.localComputeEnabled) {
    budget = zeroBudget(budget);
    route = fallbackRoute();
    reason = "background_compute_disabled";
  }

  const share = clampShare(budget.sustainedCpuShare);
  const effectiveWorkerLimit = share <= 0 ? 0 : Math.max(1, Math.min(cores, Math.floor(cores * share) || 1));
  const communityPowerEligible = deviceClass === "desktop" || charging;
  const communityThermalEligible = !["serious", "critical"].includes(thermalState);
  const communityVisibilityEligible = visibility === "visible" || settings.backgroundComputeEnabled;
  const communityComputeEligible = Boolean(settings.communityComputeEnabled && settings.localComputeEnabled && communityPowerEligible && communityThermalEligible && communityVisibilityEligible && share > 0);
  const communityComputeReason = !settings.communityComputeEnabled ? "not_opted_in" : !settings.localComputeEnabled ? "personal_compute_disabled" : !communityPowerEligible ? "power_not_eligible" : !communityThermalEligible ? "thermal_guard" : !communityVisibilityEligible ? "background_not_allowed" : share <= 0 ? "budget_paused" : "eligible";

  return Object.freeze({
    deviceClass,
    mode: settings.mode,
    thermalState,
    thermalTelemetryAvailable: thermalState !== "unknown",
    connectivityState,
    internetAvailable: connectivity.internetAvailable,
    localNetworkAvailable: connectivity.localNetworkAvailable,
    route,
    reason,
    effectiveWorkerLimit,
    schedulerDutyCycleShare: share,
    maxAdaptiveComputeShare: MAX_ADAPTIVE_COMPUTE_SHARE,
    npuPreferred: true,
    gpuPreferredAfterNpu: true,
    cpuFallbackAllowed: true,
    cloudFallbackAllowed: connectivity.internetAvailable,
    ownDeviceMeshAvailable: ownDesktopReachable,
    offlineQueueRequired: route === "offline_queue",
    motherAiIdentity: "LANERIQ AI",
    userExperiencePriority: true,
    personalComputeEnabled: settings.localComputeEnabled,
    communityComputePreferenceEnabled: settings.communityComputeEnabled,
    communityComputeEligible,
    communityComputeReason,
    communityComputeOptInRequired: true,
    communityComputeExecutionLive: false,
    crossUserComputeAllowed: false,
    thermalGuardianEnabled: true,
    privateDataUploadDefault: false,
    privacyTrackingBusinessModel: false,
    ...budget,
  });
}

export function publicDeviceComputePolicy() {
  return Object.freeze({
    policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
    motherAiIdentity: "LANERIQ AI",
    localFirst: true,
    npuFirst: true,
    ownDesktopFallback: true,
    cloudLastResort: true,
    localProjectStorageFirst: true,
    deltaSyncPreferred: true,
    offlineCapableByDesign: true,
    localNetworkOnlySupported: true,
    offlineStoreAndForward: true,
    cloudFallbackRequiresInternet: true,
    privateDataUploadDefault: false,
    privacyTrackingBusinessModel: false,
    adaptiveComputeBudget: true,
    maxAdaptiveComputeShare: MAX_ADAPTIVE_COMPUTE_SHARE,
    backgroundComputeDefault: false,
    communityComputeOptInSupported: true,
    communityComputeDefault: false,
    communityComputeExecutionLive: false,
    crossUserComputeAllowed: false,
    thermalGuardianRequired: true,
    fullMobileBudgetRequiresRealThermalTelemetry: true,
    userFacingCreditsRequired: false,
    modes: Object.values(COMPUTE_MODES),
  });
}
