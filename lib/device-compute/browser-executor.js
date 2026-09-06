export const BROWSER_EXECUTOR_VERSION = "2026-09-05.1";

export const BROWSER_EXECUTOR_TASKS = Object.freeze({
  TEXT_NORMALIZE: "text_normalize",
  VECTOR_DOT: "vector_dot",
  JSON_VALIDATE: "json_validate",
  WASM_ADD: "wasm_add",
});

const TASK_SET = new Set(Object.values(BROWSER_EXECUTOR_TASKS));
const MAX_PARALLEL_WORKERS = 4;
const DEFAULT_TIMEOUT_MS = 20_000;

const WORKER_SOURCE = `
const WASM_ADD_BYTES = new Uint8Array([0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,3,2,1,0,7,7,1,3,97,100,100,0,0,10,9,1,7,0,32,0,32,1,106,11]);
function boundedText(value){const text=String(value??'');if(text.length>2000000)throw new Error('TEXT_TOO_LARGE');return text;}
function normalizeText(value){return boundedText(value).normalize('NFKC').replace(/\\s+/g,' ').trim();}
function vectorDot(payload){
  const a=Array.isArray(payload?.a)?payload.a:[];const b=Array.isArray(payload?.b)?payload.b:[];
  if(!a.length||a.length!==b.length||a.length>250000)throw new Error('VECTOR_SHAPE_INVALID');
  let sum=0;for(let i=0;i<a.length;i+=1){const x=Number(a[i]);const y=Number(b[i]);if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('VECTOR_VALUE_INVALID');sum+=x*y;}return sum;
}
async function wasmAdd(payload){
  const a=Number(payload?.a);const b=Number(payload?.b);if(!Number.isInteger(a)||!Number.isInteger(b))throw new Error('WASM_INTEGER_REQUIRED');
  const {instance}=await WebAssembly.instantiate(WASM_ADD_BYTES);return instance.exports.add(a,b);
}
self.onmessage=async(event)=>{const msg=event.data||{};try{let result;
  if(msg.type==='text_normalize')result=normalizeText(msg.payload?.text);
  else if(msg.type==='vector_dot')result=vectorDot(msg.payload);
  else if(msg.type==='json_validate'){const text=boundedText(msg.payload?.text);const parsed=JSON.parse(text);result={valid:true,kind:Array.isArray(parsed)?'array':parsed===null?'null':typeof parsed};}
  else if(msg.type==='wasm_add')result=await wasmAdd(msg.payload);
  else throw new Error('TASK_NOT_SUPPORTED');
  self.postMessage({id:msg.id,ok:true,result});
}catch(error){self.postMessage({id:msg.id,ok:false,error:String(error?.message||error||'WORKER_FAILED').slice(0,160)});}};
`;

function positiveInt(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

export function detectBrowserExecutorCapabilities({
  navigatorLike = typeof navigator !== "undefined" ? navigator : null,
  WorkerCtor = typeof Worker !== "undefined" ? Worker : null,
  WebAssemblyImpl = typeof WebAssembly !== "undefined" ? WebAssembly : null,
  crossOriginIsolatedValue = typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
} = {}) {
  return Object.freeze({
    runtime: navigatorLike ? "browser" : "non_browser",
    workers: typeof WorkerCtor === "function",
    wasm: Boolean(WebAssemblyImpl && typeof WebAssemblyImpl.instantiate === "function"),
    webgpu: Boolean(navigatorLike?.gpu && typeof navigatorLike.gpu.requestAdapter === "function"),
    crossOriginIsolated: crossOriginIsolatedValue === true,
    hardwareConcurrency: positiveInt(navigatorLike?.hardwareConcurrency, 1),
  });
}

export function planBrowserExecution({ budget = {}, capabilities = detectBrowserExecutorCapabilities(), taskType, visibility = "visible" } = {}) {
  const type = String(taskType || "").trim();
  if (!TASK_SET.has(type)) return Object.freeze({ admitted: false, route: "BLOCK", reason: "unsupported_browser_task", taskType: type });
  if (visibility !== "visible") return Object.freeze({ admitted: false, route: "BLOCK", reason: "foreground_only", taskType: type });
  if (budget.route !== "local_device") return Object.freeze({ admitted: false, route: "BLOCK", reason: "local_device_not_admitted", taskType: type });
  if (!capabilities.workers) return Object.freeze({ admitted: false, route: "BLOCK", reason: "web_worker_unavailable", taskType: type });
  if (type === BROWSER_EXECUTOR_TASKS.WASM_ADD && !capabilities.wasm) return Object.freeze({ admitted: false, route: "BLOCK", reason: "wasm_unavailable", taskType: type });

  const deviceCeiling = budget.deviceClass === "mobile" ? 2 : MAX_PARALLEL_WORKERS;
  const maxParallel = Math.max(1, Math.min(deviceCeiling, MAX_PARALLEL_WORKERS, positiveInt(budget.effectiveWorkerLimit, 1)));
  return Object.freeze({
    admitted: true,
    route: "BROWSER_FOREGROUND",
    reason: "own_device_foreground_compute",
    taskType: type,
    engine: type === BROWSER_EXECUTOR_TASKS.WASM_ADD ? "wasm_worker" : "web_worker",
    maxParallel,
    webgpuAvailable: capabilities.webgpu === true,
    webgpuComputeKernelLive: false,
    ownDeviceOnly: true,
    crossUserComputeAllowed: false,
  });
}

export async function probeBrowserWebGPU(navigatorLike = typeof navigator !== "undefined" ? navigator : null) {
  if (!navigatorLike?.gpu || typeof navigatorLike.gpu.requestAdapter !== "function") {
    return Object.freeze({ available: false, adapterAcquired: false, reason: "webgpu_unavailable" });
  }
  try {
    const adapter = await navigatorLike.gpu.requestAdapter({ powerPreference: "low-power" });
    return Object.freeze({
      available: Boolean(adapter),
      adapterAcquired: Boolean(adapter),
      reason: adapter ? "adapter_ready" : "adapter_unavailable",
    });
  } catch (error) {
    return Object.freeze({ available: true, adapterAcquired: false, reason: "adapter_request_failed", errorCode: String(error?.name || "error").slice(0, 64) });
  }
}

function browserExecutionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createBrowserForegroundExecutor({
  budgetProvider,
  capabilitiesProvider,
  visibilityProvider,
  WorkerCtor = typeof Worker !== "undefined" ? Worker : null,
  BlobCtor = typeof Blob !== "undefined" ? Blob : null,
  URLImpl = typeof URL !== "undefined" ? URL : null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let sequence = 0;
  let active = 0;
  const waiters = [];

  const getBudget = () => typeof budgetProvider === "function" ? budgetProvider() : budgetProvider || {};
  const getCapabilities = () => typeof capabilitiesProvider === "function"
    ? capabilitiesProvider()
    : capabilitiesProvider || detectBrowserExecutorCapabilities({ WorkerCtor });
  const getVisibility = () => typeof visibilityProvider === "function"
    ? visibilityProvider()
    : typeof document !== "undefined" ? document.visibilityState : "visible";

  async function acquire(limit) {
    if (active < limit) { active += 1; return; }
    await new Promise((resolve) => waiters.push({ resolve, limit }));
  }

  function release() {
    active = Math.max(0, active - 1);
    const index = waiters.findIndex((item) => active < item.limit);
    if (index >= 0) {
      const [{ resolve }] = waiters.splice(index, 1);
      active += 1;
      resolve();
    }
  }

  async function execute(taskType, payload = {}, { signal, timeout = timeoutMs } = {}) {
    const budget = getBudget();
    const capabilities = getCapabilities();
    const plan = planBrowserExecution({ budget, capabilities, taskType, visibility: getVisibility() });
    if (!plan.admitted) throw browserExecutionError("LANERIQ_BROWSER_EXECUTION_BLOCKED", plan.reason);
    if (typeof WorkerCtor !== "function" || typeof BlobCtor !== "function" || !URLImpl?.createObjectURL) {
      throw browserExecutionError("LANERIQ_BROWSER_WORKER_RUNTIME_UNAVAILABLE", "Browser worker runtime is unavailable.");
    }
    if (signal?.aborted) throw browserExecutionError("LANERIQ_BROWSER_EXECUTION_ABORTED", "Browser execution was aborted before start.");

    await acquire(plan.maxParallel);
    let worker;
    let objectUrl;
    try {
      objectUrl = URLImpl.createObjectURL(new BlobCtor([WORKER_SOURCE], { type: "text/javascript" }));
      worker = new WorkerCtor(objectUrl, { name: "laneriq-l4-foreground" });
      URLImpl.revokeObjectURL?.(objectUrl);
      objectUrl = null;
      const id = `l4-${Date.now()}-${sequence += 1}`;

      return await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener?.("abort", onAbort);
          worker?.terminate?.();
          callback(value);
        };
        const onAbort = () => finish(reject, browserExecutionError("LANERIQ_BROWSER_EXECUTION_ABORTED", "Browser execution was aborted."));
        const timer = setTimeout(() => finish(reject, browserExecutionError("LANERIQ_BROWSER_EXECUTION_TIMEOUT", "Browser foreground execution timed out.")), Math.max(1000, Number(timeout) || DEFAULT_TIMEOUT_MS));
        signal?.addEventListener?.("abort", onAbort, { once: true });
        worker.onmessage = (event) => {
          const message = event?.data || {};
          if (message.id !== id) return;
          if (message.ok === true) finish(resolve, Object.freeze({ result: message.result, plan }));
          else finish(reject, browserExecutionError("LANERIQ_BROWSER_TASK_FAILED", String(message.error || "Browser task failed.")));
        };
        worker.onerror = () => finish(reject, browserExecutionError("LANERIQ_BROWSER_WORKER_FAILED", "Browser worker failed."));
        worker.postMessage({ id, type: taskType, payload });
      });
    } finally {
      if (objectUrl) URLImpl?.revokeObjectURL?.(objectUrl);
      worker?.terminate?.();
      release();
    }
  }

  return Object.freeze({ execute, getActiveCount: () => active });
}

export function publicBrowserExecutorTruth() {
  return Object.freeze({
    version: BROWSER_EXECUTOR_VERSION,
    browserForegroundExecutorLive: true,
    webWorkerTaskRuntimeLive: true,
    wasmWorkerKernelLive: true,
    webgpuAdapterProbeLive: true,
    webgpuComputeKernelLive: false,
    browserAiInferenceRuntimeLive: false,
    foregroundOnly: true,
    ownDeviceOnly: true,
    crossUserComputeAllowed: false,
    maxParallelWorkers: MAX_PARALLEL_WORKERS,
    supportedTasks: Object.values(BROWSER_EXECUTOR_TASKS),
    evidenceBoundary: "L4 executes bounded own-device browser worker/WASM utility tasks and probes WebGPU. It does not yet claim WebGPU model inference or native mobile inference.",
  });
}
