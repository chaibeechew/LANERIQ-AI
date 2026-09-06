import assert from "node:assert/strict";
import fs from "node:fs";

import {
  COMPUTE_MODES,
  DEVICE_COMPUTE_POLICY_VERSION,
  MAX_ADAPTIVE_COMPUTE_SHARE,
  classifyDevice,
  computeDeviceBudget,
  createDefaultDeviceComputeSettings,
  publicDeviceComputePolicy,
  sanitizeDeviceComputeSettings,
} from "../lib/device-compute/policy.js";
import { zeroCostPolicy } from "../lib/soolen/cost-policy.js";

const manager = fs.readFileSync("app/components/DeviceComputeManager.js", "utf8");
const settingsPage = fs.readFileSync("app/account/device-compute/page.js", "utf8");
const accountNav = fs.readFileSync("app/components/AccountNav.js", "utf8");
const layout = fs.readFileSync("app/layout.js", "utf8");
const liuiHomeCss = fs.readFileSync("app/home-liui-v5.css", "utf8");

const defaults = createDefaultDeviceComputeSettings();
assert.equal(defaults.decision, null);
assert.equal(defaults.localComputeEnabled, false, "Personal Compute must not silently enable before the user's explicit first-use choice.");
assert.equal(defaults.mode, "balanced");
assert.equal(defaults.backgroundComputeEnabled, false, "Background compute must be OFF by default.");
assert.equal(defaults.ownDesktopRemoteComputeEnabled, false, "Remote Desktop compute needs a separate opt-in.");
assert.equal(defaults.communityComputeEnabled, false, "Community Compute must be OFF by default and separately opted in.");
assert.equal(defaults.crossUserComputeEnabled, false, "Legacy cross-user execution flag must stay OFF.");
assert.equal(defaults.thermalGuardianEnabled, true);
assert.equal(MAX_ADAPTIVE_COMPUTE_SHARE, 0.05);
assert.deepEqual(Object.values(COMPUTE_MODES).map((mode) => mode.label), ["Eco", "Balanced", "Enhanced"]);

const hostileSettings = sanitizeDeviceComputeSettings({
  decision: "local",
  localComputeEnabled: true,
  mode: "enhanced",
  backgroundComputeEnabled: true,
  ownDesktopRemoteComputeEnabled: true,
  communityComputeEnabled: true,
  communityComputeConsentAt: "2026-09-05T00:00:00.000Z",
  crossUserComputeEnabled: true,
  thermalGuardianEnabled: false,
});
assert.equal(hostileSettings.localComputeEnabled, true);
assert.equal(hostileSettings.communityComputeEnabled, true, "Explicit Community Compute preference may be stored only after Personal Compute is enabled.");
assert.equal(hostileSettings.crossUserComputeEnabled, false, "Legacy cross-user execution state must still be forced OFF.");
assert.equal(hostileSettings.thermalGuardianEnabled, true, "Thermal Guardian cannot be disabled by stored/user-controlled state.");

const cloudOnlyCommunityAttempt = sanitizeDeviceComputeSettings({
  decision: "cloud_only",
  localComputeEnabled: false,
  communityComputeEnabled: true,
});
assert.equal(cloudOnlyCommunityAttempt.communityComputeEnabled, false, "Community Compute cannot remain enabled when Personal Compute is disabled.");

assert.equal(classifyDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)", hardwareConcurrency: 6, maxTouchPoints: 5 }), "mobile");
assert.equal(classifyDevice({ userAgent: "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)", hardwareConcurrency: 8, maxTouchPoints: 5 }), "tablet");
assert.equal(classifyDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", hardwareConcurrency: 16, deviceMemory: 16 }), "desktop");

const balancedMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "balanced" },
  deviceClass: "mobile",
  thermalState: "nominal",
  batteryLevel: 0.8,
  charging: false,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(balancedMobile.route, "local_device");
assert.equal(balancedMobile.sustainedCpuShare, 0.01);
assert.equal(balancedMobile.burstGpuShare, 0.03);
assert.ok(balancedMobile.burstGpuShare <= MAX_ADAPTIVE_COMPUTE_SHARE);
assert.equal(balancedMobile.npuPreferred, true);
assert.equal(balancedMobile.motherAiIdentity, "LANERIQ AI");
assert.equal(balancedMobile.userExperiencePriority, true);
assert.equal(balancedMobile.communityComputePreferenceEnabled, false);
assert.equal(balancedMobile.communityComputeExecutionLive, false);
assert.equal(balancedMobile.crossUserComputeAllowed, false);

const enhancedChargingMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "enhanced" },
  deviceClass: "mobile",
  thermalState: "nominal",
  batteryLevel: 0.9,
  charging: true,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(enhancedChargingMobile.burstCpuShare, 0.05);
assert.equal(enhancedChargingMobile.burstGpuShare, 0.05);
assert.equal(enhancedChargingMobile.maxAdaptiveComputeShare, 0.05);

const unknownThermalEnhancedMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "enhanced" },
  deviceClass: "mobile",
  thermalState: "unknown",
  batteryLevel: 0.8,
  charging: true,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(unknownThermalEnhancedMobile.thermalTelemetryAvailable, false);
assert.equal(unknownThermalEnhancedMobile.reason, "thermal_unknown_conservative");
assert.ok(unknownThermalEnhancedMobile.sustainedCpuShare <= 0.01, "Unknown mobile thermal state must keep sustained CPU at or below 1%.");
assert.ok(unknownThermalEnhancedMobile.burstGpuShare <= 0.01, "Unknown mobile thermal state must cap burst GPU at or below 1%.");
assert.ok(unknownThermalEnhancedMobile.burstSeconds <= 12, "Unknown mobile thermal state must shorten bursts.");
assert.ok(unknownThermalEnhancedMobile.recoverySeconds >= 35, "Unknown mobile thermal state must lengthen recovery.");

const fairMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "balanced" },
  deviceClass: "mobile",
  thermalState: "fair",
  batteryLevel: 0.8,
  charging: true,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.ok(fairMobile.sustainedCpuShare < balancedMobile.sustainedCpuShare, "Warm thermal state must proactively reduce the local budget.");
assert.equal(fairMobile.route, "local_device");

const seriousMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "balanced", ownDesktopRemoteComputeEnabled: true },
  deviceClass: "mobile",
  thermalState: "severe",
  batteryLevel: 0.8,
  charging: true,
  visibility: "visible",
  connectivityState: "local_network_only",
  hardwareConcurrency: 8,
});
assert.equal(seriousMobile.route, "own_desktop", "Serious heat should move eligible heavy work to the user's own linked Desktop when reachable.");
assert.equal(seriousMobile.reason, "thermal_serious_paused");
assert.equal(seriousMobile.sustainedCpuShare, 0);

const criticalMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "enhanced" },
  deviceClass: "mobile",
  thermalState: "critical",
  batteryLevel: 0.9,
  charging: true,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(criticalMobile.route, "cloud_fallback");
assert.equal(criticalMobile.reason, "thermal_critical_paused");
assert.equal(criticalMobile.burstCpuShare, 0);
assert.equal(criticalMobile.effectiveWorkerLimit, 0);

const lowBatteryMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "enhanced" },
  deviceClass: "mobile",
  thermalState: "nominal",
  batteryLevel: 0.15,
  charging: false,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(lowBatteryMobile.reason, "low_battery_paused");
assert.equal(lowBatteryMobile.sustainedCpuShare, 0);
assert.equal(lowBatteryMobile.route, "cloud_fallback");

const background = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "balanced", backgroundComputeEnabled: false },
  deviceClass: "mobile",
  thermalState: "nominal",
  batteryLevel: 0.8,
  charging: true,
  visibility: "hidden",
  hardwareConcurrency: 8,
});
assert.equal(background.route, "cloud_fallback");
assert.equal(background.reason, "background_compute_disabled");
assert.equal(background.sustainedCpuShare, 0);

const communityMobile = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, mode: "balanced", communityComputeEnabled: true, communityComputeConsentAt: "2026-09-05T00:00:00.000Z" },
  deviceClass: "mobile",
  thermalState: "nominal",
  batteryLevel: 0.9,
  charging: true,
  visibility: "visible",
  hardwareConcurrency: 8,
});
assert.equal(communityMobile.communityComputePreferenceEnabled, true);
assert.equal(communityMobile.communityComputeEligible, true);
assert.equal(communityMobile.communityComputeReason, "eligible");
assert.equal(communityMobile.communityComputeExecutionLive, false, "The opt-in boundary may exist before remote community workload execution is live.");
assert.equal(communityMobile.crossUserComputeAllowed, false, "No cross-user task execution may occur until the secure community runtime is separately admitted.");

const publicPolicy = publicDeviceComputePolicy();
assert.equal(publicPolicy.policyVersion, DEVICE_COMPUTE_POLICY_VERSION);
assert.equal(publicPolicy.motherAiIdentity, "LANERIQ AI");
assert.equal(publicPolicy.localFirst, true);
assert.equal(publicPolicy.npuFirst, true);
assert.equal(publicPolicy.deltaSyncPreferred, true);
assert.equal(publicPolicy.backgroundComputeDefault, false);
assert.equal(publicPolicy.communityComputeOptInSupported, true);
assert.equal(publicPolicy.communityComputeDefault, false);
assert.equal(publicPolicy.communityComputeExecutionLive, false);
assert.equal(publicPolicy.crossUserComputeAllowed, false);
assert.equal(publicPolicy.thermalGuardianRequired, true);
assert.equal(publicPolicy.maxAdaptiveComputeShare, 0.05);
assert.equal(publicPolicy.privacyTrackingBusinessModel, false);
assert.equal(publicPolicy.userFacingCreditsRequired, false);

const costPolicy = zeroCostPolicy({ SOOLEN_COST_MODE: "zero" });
for (const [key, expected] of Object.entries({
  deviceFirst: true,
  localProjectStorageFirst: true,
  deltaSyncPreferred: true,
  invisibleCostGovernor: true,
  userFacingCreditsRequired: false,
  backgroundComputeDefault: false,
  ownDesktopFallbackPreferred: true,
  crossUserComputeAllowed: false,
  thermalGuardianRequired: true,
})) assert.equal(costPolicy[key], expected, `Zero-cost policy mismatch for ${key}`);

for (const pattern of [
  /Allow Mother AI Device Intelligence — Recommended/,
  /Use Cloud Only/,
  /Community Compute all stay OFF/i,
  /Mother AI is LANERIQ AI/i,
  /0–3%/,
  /5% scheduler ceiling/,
  /__LANERIQ_NATIVE_TELEMETRY__/,
  /thermalState \|\| "unknown"/,
  /navigator\.storage\.persist\(\)/,
  /decision === "local"/,
]) assert.match(manager, pattern);
assert.doesNotMatch(manager, /temperature\s*=\s*Math\.random|thermalState\s*=\s*["']nominal["']/i, "Browser runtime must not fabricate a healthy thermal reading.");

for (const pattern of [
  /Object\.values\(COMPUTE_MODES\)/,
  /Mother AI is LANERIQ AI/,
  /Personal Compute/,
  /Community Compute/,
  /Share compute capacity, not personal data/,
  /5% ceiling/,
  /No tracking-based business model/,
  /separate opt-in required/,
  /Request persistent local storage/,
]) assert.match(settingsPage, pattern);

assert.match(layout, /import DeviceComputeManager from "\.\/components\/DeviceComputeManager"/);
assert.match(layout, /<DeviceComputeManager\s*\/>/);
assert.match(layout, /home-liui-v5\.css/,'Invisible-cost UI policy must live in the active LIUI design layer.');
assert.doesNotMatch(layout, /local-first-cost-control\.css/,'Retired homepage/cost visual layer must not return to the active runtime.');
assert.match(accountNav, /\/account\/device-compute/);
assert.doesNotMatch(accountNav, /go\("\/credits"\)/, "Credits must not remain a primary Account menu item during the current invisible-cost-governor stage.");
assert.match(liuiHomeCss, /\.premiumHome \.topActions > a\.credits/);
assert.match(liuiHomeCss, /display:\s*none\s*!important/);

console.log("✓ Mother AI is LANERIQ AI and Personal Compute still requires an explicit first-use choice");
console.log("✓ Eco/Balanced/Enhanced enforce a hard 5% adaptive scheduler ceiling and can fall to 0%");
console.log("✓ Thermal, battery and background guards pause rather than forcing a minimum compute load");
console.log("✓ Community Compute is a separate explicit opt-in and is never enabled by ordinary Personal Compute consent");
console.log("✓ Community preference can be recorded while cross-user workload execution remains gated OFF until a secure runtime is admitted");
console.log("✓ Compute permission remains separate from content permission and the product declares no tracking-based business model");
console.log("✓ Local project storage, same-user Desktop fallback and invisible cost governance remain intact");
