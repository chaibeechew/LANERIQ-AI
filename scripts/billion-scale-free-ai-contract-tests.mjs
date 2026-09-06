import assert from "node:assert/strict";
import fs from "node:fs";

import {
  BILLION_SCALE_FREE_AI_VERSION,
  CONNECTIVITY_STATES,
  PRIVACY_CLASSES,
  assertFreeAiExecutionSafe,
  connectivityCapabilities,
  planFreeAiExecution,
  planReconnectSync,
  publicBillionScaleFreeAiPolicy,
} from "../lib/offline/billion-scale-free-ai.js";
import { computeDeviceBudget, createDefaultDeviceComputeSettings, publicDeviceComputePolicy } from "../lib/device-compute/policy.js";
import {
  BROWSER_EXECUTOR_TASKS,
  detectBrowserExecutorCapabilities,
  planBrowserExecution,
  publicBrowserExecutorTruth,
} from "../lib/device-compute/browser-executor.js";
import { buildPersistentReuseKey, getSemanticReusePersistenceTruth } from "../lib/ai/semantic-reuse-persistence.js";
import { assertAdmissionSafe, decideZeroCostAdmission, ZERO_COST_ADMISSION_POLICY } from "../lib/ai/zero-cost-admission-controller.js";
import { zeroCostPolicy } from "../lib/soolen/cost-policy.js";

assert.deepEqual(CONNECTIVITY_STATES, ["online_fast", "online_limited", "online_expensive", "local_network_only", "offline"]);
assert.equal(PRIVACY_CLASSES.P3, "user_private");
assert.equal(connectivityCapabilities("offline").internetAvailable, false);
assert.equal(connectivityCapabilities("offline").localNetworkAvailable, false);
assert.equal(connectivityCapabilities("local_network_only").internetAvailable, false);
assert.equal(connectivityCapabilities("local_network_only").localNetworkAvailable, true);
assert.equal(connectivityCapabilities("online_expensive").meteredOrConstrained, true);

const deterministicOffline = planFreeAiExecution({ costMode: "free", connectivityState: "offline", deterministicHit: true });
assert.equal(deterministicOffline.route, "DETERMINISTIC");
assert.equal(deterministicOffline.laneriqPaidInference, false);
assertFreeAiExecutionSafe(deterministicOffline);

const reuseOffline = planFreeAiExecution({ costMode: "free", connectivityState: "offline", reuseHit: true });
assert.equal(reuseOffline.route, "REUSE");
const cacheOffline = planFreeAiExecution({ costMode: "free", connectivityState: "offline", cacheHit: true });
assert.equal(cacheOffline.route, "LOCAL_CACHE");
const localOffline = planFreeAiExecution({ costMode: "free", connectivityState: "offline", localEngineAvailable: true });
assert.equal(localOffline.route, "LOCAL_ENGINE");

const meshLanOnly = planFreeAiExecution({ costMode: "free", connectivityState: "local_network_only", ownDeviceMeshAvailable: true });
assert.equal(meshLanOnly.route, "OWN_DEVICE_MESH");
assert.equal(meshLanOnly.networkRequired, false);
assert.equal(meshLanOnly.crossUserComputeAllowed, false);

const verifiedFree = planFreeAiExecution({ costMode: "free", connectivityState: "online_fast", verifiedFreeProviderAvailable: true });
assert.equal(verifiedFree.route, "VERIFIED_FREE_PROVIDER");
assert.equal(verifiedFree.laneriqSpendRisk, 0);

const sponsored = planFreeAiExecution({ costMode: "free", connectivityState: "online_fast", sponsoredComputeAvailable: true, sponsoredHardStopVerified: true });
assert.equal(sponsored.route, "SPONSORED_COMPUTE");
assert.equal(sponsored.laneriqPaidInference, false);

const byo = planFreeAiExecution({ costMode: "free", connectivityState: "online_fast", byoComputeAvailable: true, byoUserApproved: true });
assert.equal(byo.route, "BYO_COMPUTE");
assert.equal(byo.userProviderCostMayApply, true, "BYO must never be mislabeled as cost-free to the user.");
assert.equal(byo.laneriqPaidInference, false);

const offlineQueue = planFreeAiExecution({ costMode: "free", connectivityState: "offline", queueAllowed: true });
assert.equal(offlineQueue.route, "QUEUE");
assert.equal(offlineQueue.reason, "offline_store_and_forward");
assert.equal(offlineQueue.paidManagedBlocked, true);
assertFreeAiExecutionSafe(offlineQueue);

const managedPaid = planFreeAiExecution({ costMode: "paid", connectivityState: "online_fast", queueAllowed: false, paidManagedAvailable: true, paidManagedAllowed: true });
assert.equal(managedPaid.route, "PAID_MANAGED");
assert.equal(managedPaid.laneriqPaidInference, true);
assert.equal(managedPaid.paidManagedBlocked, false);
assert.throws(() => assertFreeAiExecutionSafe({ ...managedPaid, costMode: "free" }), /MANAGED_PAID_FORBIDDEN/);
assert.throws(() => assertFreeAiExecutionSafe({ ...verifiedFree, connectivityState: "offline" }), /REMOTE_ROUTE_WITHOUT_INTERNET/);

const aggregateSync = planReconnectSync({ privacyClass: "P1", connectivityState: "online_fast" });
assert.equal(aggregateSync.allowed, true);
assert.equal(aggregateSync.route, "AGGREGATE_METADATA");
assert.equal(aggregateSync.plaintextAllowed, false);
const privateLocal = planReconnectSync({ privacyClass: "P3", connectivityState: "online_fast" });
assert.equal(privateLocal.allowed, false);
assert.equal(privateLocal.route, "LOCAL_ONLY");
const privateEncryptedDelta = planReconnectSync({ privacyClass: "P3", connectivityState: "online_fast", privateSyncOptIn: true, encrypted: true, deltaAvailable: true });
assert.equal(privateEncryptedDelta.allowed, true);
assert.equal(privateEncryptedDelta.route, "ENCRYPTED_DELTA");
assert.equal(privateEncryptedDelta.plaintextAllowed, false);
const sensitive = planReconnectSync({ privacyClass: "P4", connectivityState: "online_fast", privateSyncOptIn: true, encrypted: true, deltaAvailable: true });
assert.equal(sensitive.allowed, false);
assert.equal(sensitive.route, "BLOCK");
const offlineMetadata = planReconnectSync({ privacyClass: "P1", connectivityState: "offline" });
assert.equal(offlineMetadata.allowed, false);
assert.equal(offlineMetadata.route, "LOCAL_ONLY");

const defaults = createDefaultDeviceComputeSettings();
const offlineLocal = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true },
  deviceClass: "mobile",
  thermalState: "nominal",
  connectivityState: "offline",
  hardwareConcurrency: 8,
});
assert.equal(offlineLocal.route, "local_device");
assert.equal(offlineLocal.cloudFallbackAllowed, false);
assert.equal(offlineLocal.privateDataUploadDefault, false);

const offlineCritical = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true },
  deviceClass: "mobile",
  thermalState: "critical",
  connectivityState: "offline",
  hardwareConcurrency: 8,
});
assert.equal(offlineCritical.route, "offline_queue", "Critical heat while fully offline must not pretend cloud fallback exists.");
assert.equal(offlineCritical.offlineQueueRequired, true);

const lanMesh = computeDeviceBudget({
  settings: { ...defaults, decision: "local", localComputeEnabled: true, ownDesktopRemoteComputeEnabled: true },
  deviceClass: "mobile",
  thermalState: "serious",
  connectivityState: "local_network_only",
  hardwareConcurrency: 8,
});
assert.equal(lanMesh.route, "own_desktop");
assert.equal(lanMesh.internetAvailable, false);
assert.equal(lanMesh.localNetworkAvailable, true);
assert.equal(lanMesh.ownDeviceMeshAvailable, true);

const cloudOnlyOffline = computeDeviceBudget({
  settings: { ...defaults, decision: "cloud_only", localComputeEnabled: false },
  deviceClass: "mobile",
  connectivityState: "offline",
  hardwareConcurrency: 8,
});
assert.equal(cloudOnlyOffline.route, "offline_queue");
assert.equal(cloudOnlyOffline.cloudFallbackAllowed, false);

const browserCapabilities = detectBrowserExecutorCapabilities({
  navigatorLike: { hardwareConcurrency: 8, gpu: { requestAdapter: async () => ({}) } },
  WorkerCtor: function WorkerContractStub() {},
  WebAssemblyImpl: { instantiate: async () => ({}) },
  crossOriginIsolatedValue: true,
});
assert.equal(browserCapabilities.workers, true);
assert.equal(browserCapabilities.wasm, true);
assert.equal(browserCapabilities.webgpu, true);
const browserPlan = planBrowserExecution({
  budget: offlineLocal,
  capabilities: browserCapabilities,
  taskType: BROWSER_EXECUTOR_TASKS.VECTOR_DOT,
  visibility: "visible",
});
assert.equal(browserPlan.admitted, true);
assert.equal(browserPlan.route, "BROWSER_FOREGROUND");
assert.ok(browserPlan.maxParallel >= 1 && browserPlan.maxParallel <= 2, "Mobile browser executor must remain conservatively bounded.");
assert.equal(browserPlan.ownDeviceOnly, true);
assert.equal(browserPlan.crossUserComputeAllowed, false);
assert.equal(planBrowserExecution({ budget: offlineLocal, capabilities: browserCapabilities, taskType: BROWSER_EXECUTOR_TASKS.VECTOR_DOT, visibility: "hidden" }).reason, "foreground_only");
assert.equal(planBrowserExecution({ budget: cloudOnlyOffline, capabilities: browserCapabilities, taskType: BROWSER_EXECUTOR_TASKS.VECTOR_DOT, visibility: "visible" }).reason, "local_device_not_admitted");
const browserTruth = publicBrowserExecutorTruth();
assert.equal(browserTruth.webWorkerTaskRuntimeLive, true);
assert.equal(browserTruth.wasmWorkerKernelLive, true);
assert.equal(browserTruth.webgpuAdapterProbeLive, true);
assert.equal(browserTruth.webgpuComputeKernelLive, false);
assert.equal(browserTruth.browserAiInferenceRuntimeLive, false);
assert.equal(browserTruth.crossUserComputeAllowed, false);

const persistenceKey = buildPersistentReuseKey({
  scope: "contract-user-scope",
  purpose: "general",
  keyMaterial: "private prompt must never be stored raw",
  variant: "v1",
});
assert.equal(persistenceKey.valid, true);
assert.match(persistenceKey.scopeHash, /^[a-f0-9]{64}$/);
assert.match(persistenceKey.exactHash, /^[a-f0-9]{64}$/);
assert.equal(Object.prototype.hasOwnProperty.call(persistenceKey, "keyMaterial"), false);
const persistenceTruth = getSemanticReusePersistenceTruth({ LANERIQ_SEMANTIC_CACHE_PERSISTENCE: "off" });
assert.equal(persistenceTruth.configured, false);
assert.equal(persistenceTruth.exactReuseOnly, true);
assert.equal(persistenceTruth.rawPromptStored, false);
assert.equal(persistenceTruth.scopeStoredAsHashOnly, true);
assert.equal(persistenceTruth.crossUserPrivateReuseAllowed, false);
assert.equal(persistenceTruth.failOpenToExistingRouterOnPersistenceError, true);

const freeAdmissionOffline = decideZeroCostAdmission({
  costMode: "free",
  connectivityState: "offline",
  localEngineAvailable: false,
  freeProviderAvailable: true,
  freeProviderHardStopVerified: true,
  interactive: false,
  queueAllowed: true,
});
assert.equal(freeAdmissionOffline.route, "QUEUE");
assert.equal(freeAdmissionOffline.reason, "offline_store_and_forward");
assertAdmissionSafe(freeAdmissionOffline, { costMode: "free" });

const meshAdmission = decideZeroCostAdmission({
  costMode: "free",
  connectivityState: "local_network_only",
  localEngineAvailable: false,
  ownDeviceMeshAvailable: true,
});
assert.equal(meshAdmission.route, "OWN_DEVICE_MESH");
assertAdmissionSafe(meshAdmission, { costMode: "free" });
assert.equal(ZERO_COST_ADMISSION_POLICY.offlineRemoteRoutesAllowed, false);
assert.equal(ZERO_COST_ADMISSION_POLICY.ownDeviceMeshBeforeRemote, true);
assert.equal(ZERO_COST_ADMISSION_POLICY.crossUserComputeAllowed, false);

const devicePolicy = publicDeviceComputePolicy();
assert.equal(devicePolicy.offlineCapableByDesign, true);
assert.equal(devicePolicy.localNetworkOnlySupported, true);
assert.equal(devicePolicy.offlineStoreAndForward, true);
assert.equal(devicePolicy.cloudFallbackRequiresInternet, true);
assert.equal(devicePolicy.privateDataUploadDefault, false);

const freeAiPolicy = publicBillionScaleFreeAiPolicy();
assert.equal(freeAiPolicy.version, BILLION_SCALE_FREE_AI_VERSION);
assert.equal(freeAiPolicy.freeModeManagedPaidFallbackAllowed, false);
assert.equal(freeAiPolicy.zeroModeManagedPaidFallbackAllowed, false);
assert.equal(freeAiPolicy.crossUserComputeAllowed, false);
assert.equal(freeAiPolicy.nativeOfflineModelRuntimeLive, false);
assert.equal(freeAiPolicy.sameUserLanMeshLive, false);
assert.equal(freeAiPolicy.evidenceLevel, "CODE_READY");

const cost = zeroCostPolicy({ SOOLEN_COST_MODE: "free" });
for (const [key, expected] of Object.entries({
  billionScaleFreeAiArchitecture: true,
  localFirst: true,
  offlineFirst: true,
  cloudOptionalWherePossible: true,
  privacyByDefault: true,
  syncOnlyWhatIsNecessary: true,
  localCacheBeforeAI: true,
  ownDeviceMeshBeforeRemote: true,
  storeAndForwardOfflineJobs: true,
  freeModeManagedPaidFallbackAllowed: false,
  zeroModeManagedPaidFallbackAllowed: false,
  privateTelemetryContentUploadDefault: false,
  highlySensitiveAutoSyncAllowed: false,
  crossUserComputeAllowed: false,
})) assert.equal(cost[key], expected, `Billion-scale free AI policy mismatch for ${key}`);
assert.equal(cost.externalSpendCap, 0);

const policyRoute = fs.readFileSync("app/api/device-compute/policy/route.js", "utf8");
assert.match(policyRoute, /publicBillionScaleFreeAiPolicy/);
assert.match(policyRoute, /privateTelemetryContentUploadDefault/);
assert.match(policyRoute, /freeModeManagedPaidFallbackAllowed/);

const deviceComputeManager = fs.readFileSync("app/components/DeviceComputeManager.js", "utf8");
assert.match(deviceComputeManager, /createBrowserForegroundExecutor/);
assert.match(deviceComputeManager, /executeForegroundTask/);
assert.match(deviceComputeManager, /probeWebGPU/);
assert.match(deviceComputeManager, /crossUserComputeAllowed:\s*false/);

const admittedGeneration = fs.readFileSync("lib/ai/zero-cost-admitted-generation.js", "utf8");
assert.match(admittedGeneration, /lookupPersistentSemanticReuse/);
assert.match(admittedGeneration, /persistentReuseBeforeInference:\s*true/);
assert.match(admittedGeneration, /storePersistentSemanticReuse/);

console.log("✓ LANERIQ Free AI routes deterministic/reuse/cache/local/own-device before any remote capacity");
console.log("✓ L0 persistent exact semantic reuse is scope-hashed, raw-prompt-free, and fail-open only as a cache miss");
console.log("✓ L4 browser foreground execution exposes bounded Web Worker/WASM tasks with WebGPU probe and cross-user compute forced OFF");
console.log("✓ Fully offline execution cannot claim cloud fallback; jobs store-and-forward when no safe local capacity exists");
console.log("✓ Same-user LAN device mesh is allowed by policy while cross-user compute remains forced OFF");
console.log("✓ Free/zero modes cannot enter LANERIQ-managed paid inference; sponsored/BYO paths remain explicit and bounded");
console.log("✓ Reconnect sync keeps P3 private content local by default, requires encrypted delta opt-in, and blocks P4 automatic sync");
console.log("✓ Batch 133 keeps native offline model/LAN mesh/WebGPU inference truth flags false until physical runtime evidence exists");

await import("./offline-runtime-core-contract-tests.mjs");
