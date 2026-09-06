import { assertRuntimeUrlAllowed } from "../soolen/security-policy.js";
import { createCognitiveEnvelope,recordCognitiveTelemetry } from "../soolen/cognitive-integration.js";
import { resolveMediaCostAdmission } from "../ai/media-cost-admission.js";

export const VIDEO_RENDER_LIMITS=Object.freeze({renderTimeoutMs:45000,statusTimeoutMs:15000,maxOutputLength:4000,maxJobIdLength:160});
const SAFE_RENDER_STATUSES = new Set(["queued", "rendering", "completed", "failed"]);
const JOB_ID=/^[A-Za-z0-9._:-]{1,160}$/;
const REQUEST_ID=/^[A-Za-z0-9._:-]{1,160}$/;

export class VideoRenderGatewayError extends Error {
  constructor(message, code = "VIDEO_RENDER_GATEWAY_ERROR", status = 502) {
    super(message);
    this.name = "VideoRenderGatewayError";
    this.code = code;
    this.status = status;
  }
}

function cleanText(value, max = 2000) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function rendererHeaders(requestId="",cognitive=null) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const token = String(process.env.VIDEO_RENDER_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const stable=cleanText(requestId,160);if(REQUEST_ID.test(stable))headers["Idempotency-Key"]=stable;
  if(cognitive?.reasoningMode)headers["X-LANERIQ-Cognitive-Mode"]=cognitive.reasoningMode;
  if(cognitive?.evidenceClass)headers["X-LANERIQ-Evidence-Class"]=cognitive.evidenceClass;
  return headers;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

function normalizeStatus(value, fallback = "queued") {
  const raw = String(value || "").toLowerCase().trim();
  if (["ready", "complete", "completed", "succeeded", "success", "done"].includes(raw)) return "completed";
  if (["running", "processing", "rendering", "in_progress", "in-progress"].includes(raw)) return "rendering";
  if (["error", "errored", "failed", "cancelled", "canceled"].includes(raw)) return "failed";
  if (["pending", "accepted", "queued"].includes(raw)) return "queued";
  return SAFE_RENDER_STATUSES.has(raw) ? raw : fallback;
}

function outputHostAllowlist(){
  const allow=new Set(String(process.env.VIDEO_RENDER_OUTPUT_HOST_ALLOWLIST||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean));
  for(const value of [process.env.VIDEO_RENDER_ENDPOINT,process.env.VIDEO_RENDER_STATUS_ENDPOINT]){try{const url=new URL(String(value||"").replace("{jobId}","job"));if(url.protocol==="https:")allow.add(url.hostname.toLowerCase());}catch{}}
  return allow;
}

export function normalizeVideoOutputPath(value) {
  const output = cleanText(value, VIDEO_RENDER_LIMITS.maxOutputLength);
  if (!output) return null;
  if (/^https:\/\//i.test(output)) {
    let url;try{url=new URL(output);}catch{return null;}
    if(url.protocol!=="https:"||url.username||url.password||!outputHostAllowlist().has(url.hostname.toLowerCase()))return null;
    return url.toString();
  }
  if(output.includes("..")||output.includes(":"))return null;
  if (/^\/?[A-Za-z0-9_.-][A-Za-z0-9_./-]{0,3999}$/.test(output)) return output;
  return null;
}

function safeJson(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function checkedEndpoint(value, code) {
  if (!String(value || "").trim()) return null;
  try { return assertRuntimeUrlAllowed(String(value).trim()); }
  catch (error) { throw new VideoRenderGatewayError("The configured video runtime is not allowed.", code, error?.status || 500); }
}

function normalizeCostClass(value) {
  const costClass = String(value || "metered").trim().toLowerCase();
  return ["zero", "free", "metered"].includes(costClass) ? costClass : "metered";
}

export function getVideoRendererConfig() {
  const provider = cleanText(process.env.VIDEO_RENDER_PROVIDER || "", 80);
  const rawEndpoint = String(process.env.VIDEO_RENDER_ENDPOINT || "").trim();
  const rawStatusEndpoint = String(process.env.VIDEO_RENDER_STATUS_ENDPOINT || "").trim();
  const costClass = normalizeCostClass(process.env.VIDEO_RENDER_COST_CLASS);
  const connected = Boolean(provider && rawEndpoint);
  const admission = resolveMediaCostAdmission({ kind: "video", provider, costClass, connected });
  return {
    provider: provider || "provider-neutral",
    connected,
    configured: connected && admission.externalAllowed,
    blockedByCostPolicy: admission.blockedByCostPolicy,
    chargeRequired: admission.chargeRequired,
    zeroCostExecution: admission.zeroCostExecution,
    freeTierHardStopVerified: admission.freeTierHardStopVerified,
    admissionRoute: admission.route,
    admissionReason: admission.reason,
    costClass,
    costMode: admission.costMode,
    endpoint: rawEndpoint || null,
    statusEndpoint: rawStatusEndpoint || null,
  };
}

export async function startVideoRender({ project, version, editJson, requestId }) {
  const config = getVideoRendererConfig();
  const duration=Math.max(0,Number(version?.duration_seconds||0));
  const cognitive=createCognitiveEnvelope("ai-video",{
    goal:`Render and durably capture a ${duration||"bounded"} second video output`,
    complexity:Math.min(1,.65+Math.min(180,duration)/600),
    uncertainty:{evidenceCoverage:config.configured?.55:.25,sourceAgreement:.5,testCoverage:.4,evidenceClass:"INTERNAL",externalVerificationRequired:config.configured},
  });
  const operationId=`video:${cleanText(project?.id,120)}:${cleanText(version?.id,120)}:${cleanText(requestId,160)}`;
  const startedAt=Date.now();
  recordCognitiveTelemetry({domain:"ai-video",phase:"gateway",envelope:cognitive,operationId,outcome:"planned",provider:config.provider});
  if (config.blockedByCostPolicy) {
    recordCognitiveTelemetry({domain:"ai-video",phase:"gateway",envelope:cognitive,operationId,outcome:"cost-policy-blocked",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new VideoRenderGatewayError("Connected video rendering is blocked by the active cost policy.", "VIDEO_RENDER_COST_POLICY_BLOCKED", 403);
  }
  if (!config.configured) return { configured: false, started: false, status: "draft", jobId: null, outputPath: null, provider: null, admissionRoute: config.admissionRoute, cognitive };
  const stableRequestId=cleanText(requestId||version?.source_request_id,160);if(!REQUEST_ID.test(stableRequestId))throw new VideoRenderGatewayError("A stable renderer request id is required.","VIDEO_RENDER_REQUEST_ID_INVALID",400);

  const endpoint = checkedEndpoint(config.endpoint, "VIDEO_RENDER_ENDPOINT_INVALID");
  const timeout = withTimeout(VIDEO_RENDER_LIMITS.renderTimeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: rendererHeaders(stableRequestId,cognitive),
      body: JSON.stringify({
        schemaVersion: 2,
        idempotencyKey: stableRequestId,
        requestId: stableRequestId,
        project: {
          id: project.id,
          name: cleanText(project.name, 160),
          style: project.style,
          deviceClass: project.device_class,
          maxDurationSeconds: project.max_duration_seconds,
        },
        version: {
          id: version.id,
          versionNo: version.version_no,
          durationSeconds: Number(version.duration_seconds || 0),
        },
        edit: editJson,
        requestedOutput: { container: "mp4", finalEncode: true, durableCaptureRequired: true },
      }),
      cache: "no-store",
      redirect: "error",
      signal: timeout.signal,
    });
  } catch (error) {
    recordCognitiveTelemetry({domain:"ai-video",phase:"provider",envelope:cognitive,operationId,outcome:error?.name==="AbortError"?"timeout":"unreachable",provider:config.provider,latencyMs:Date.now()-startedAt});
    if (error?.name === "AbortError") throw new VideoRenderGatewayError("The connected video renderer timed out while accepting the job.", "VIDEO_RENDER_TIMEOUT", 504);
    throw new VideoRenderGatewayError("The connected video renderer is unavailable.", "VIDEO_RENDER_UNREACHABLE", 503);
  } finally {
    timeout.done();
  }

  const raw = await response.text();
  const data = safeJson(raw);
  if (!response.ok) {
    recordCognitiveTelemetry({domain:"ai-video",phase:"provider",envelope:cognitive,operationId,outcome:"rejected",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new VideoRenderGatewayError("The connected video renderer rejected this job.", cleanText(data?.code, 100) || "VIDEO_RENDER_REJECTED", response.status >= 400 && response.status < 600 ? response.status : 502);
  }

  const outputPath = normalizeVideoOutputPath(data?.outputPath || data?.outputUrl || data?.videoUrl || data?.url);
  const rawJobId=cleanText(data?.jobId || data?.id || data?.renderId, VIDEO_RENDER_LIMITS.maxJobIdLength);
  const jobId = JOB_ID.test(rawJobId)?rawJobId:null;
  let status = normalizeStatus(data?.status, outputPath ? "completed" : "queued");
  if (outputPath) status = "completed";
  if (!jobId && !outputPath) {
    recordCognitiveTelemetry({domain:"ai-video",phase:"provider",envelope:cognitive,operationId,outcome:"invalid-output",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new VideoRenderGatewayError("The connected video renderer returned no usable job or approved output.", "VIDEO_RENDER_INVALID_RESPONSE", 502);
  }
  recordCognitiveTelemetry({domain:"ai-video",phase:"provider",envelope:cognitive,operationId,outcome:status,provider:config.provider,latencyMs:Date.now()-startedAt});
  return { configured: true, started: true, status, jobId, outputPath, provider: config.provider, admissionRoute: config.admissionRoute, chargeRequired: config.chargeRequired, zeroCostExecution: config.zeroCostExecution, cognitive };
}

function statusUrl(template, jobId) {
  const rawJobId=cleanText(jobId,VIDEO_RENDER_LIMITS.maxJobIdLength);
  if (!JOB_ID.test(rawJobId)) throw new VideoRenderGatewayError("Render job id is invalid.", "VIDEO_RENDER_JOB_ID_INVALID", 400);
  const cleanJobId = encodeURIComponent(rawJobId);
  const raw = String(template || "").trim();
  if (!raw) return null;
  const expanded = raw.includes("{jobId}") ? raw.replaceAll("{jobId}", cleanJobId) : `${raw}${raw.includes("?") ? "&" : "?"}jobId=${cleanJobId}`;
  return checkedEndpoint(expanded, "VIDEO_RENDER_STATUS_ENDPOINT_INVALID");
}

export async function checkVideoRenderStatus({ jobId }) {
  const config = getVideoRendererConfig();
  const cognitive=createCognitiveEnvelope("ai-video",{goal:"Verify connected video render status and approved durable output",complexity:.55,uncertainty:{evidenceCoverage:.55,sourceAgreement:.5,testCoverage:.45,evidenceClass:"INTERNAL",externalVerificationRequired:config.configured}});
  const operationId=`video-status:${cleanText(jobId,160)}:${config.provider}`;
  const startedAt=Date.now();
  if (config.blockedByCostPolicy) throw new VideoRenderGatewayError("Connected video rendering is blocked by the active cost policy.", "VIDEO_RENDER_COST_POLICY_BLOCKED", 403);
  if (!config.configured || !config.statusEndpoint) return { checked: false, provider: config.provider, status: null, outputPath: null, jobId, admissionRoute: config.admissionRoute, cognitive };
  const endpoint = statusUrl(config.statusEndpoint, jobId);
  const timeout = withTimeout(VIDEO_RENDER_LIMITS.statusTimeoutMs);
  let response;
  try {
    response = await fetch(endpoint, { method: "GET", headers: rendererHeaders("",cognitive), cache: "no-store", redirect: "error", signal: timeout.signal });
  } catch (error) {
    recordCognitiveTelemetry({domain:"ai-video",phase:"status",envelope:cognitive,operationId,outcome:error?.name==="AbortError"?"timeout":"unreachable",provider:config.provider,latencyMs:Date.now()-startedAt});
    if (error?.name === "AbortError") throw new VideoRenderGatewayError("The connected video renderer status check timed out.", "VIDEO_RENDER_STATUS_TIMEOUT", 504);
    throw new VideoRenderGatewayError("The connected video renderer status service is unavailable.", "VIDEO_RENDER_STATUS_UNREACHABLE", 503);
  } finally {
    timeout.done();
  }
  const raw = await response.text();
  const data = safeJson(raw);
  if (!response.ok) throw new VideoRenderGatewayError("Unable to check the connected video render job.", cleanText(data?.code, 100) || "VIDEO_RENDER_STATUS_ERROR", response.status >= 400 && response.status < 600 ? response.status : 502);
  const outputPath = normalizeVideoOutputPath(data?.outputPath || data?.outputUrl || data?.videoUrl || data?.url);
  let status = normalizeStatus(data?.status, outputPath ? "completed" : "rendering");
  if (outputPath) status = "completed";
  recordCognitiveTelemetry({domain:"ai-video",phase:"status",envelope:cognitive,operationId,outcome:status,provider:config.provider,latencyMs:Date.now()-startedAt});
  return { checked: true, provider: config.provider, status, outputPath, jobId, admissionRoute: config.admissionRoute, zeroCostExecution: config.zeroCostExecution, cognitive };
}
