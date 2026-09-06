import { assertRuntimeUrlAllowed } from "../soolen/security-policy.js";
import { createCognitiveEnvelope,recordCognitiveTelemetry } from "../soolen/cognitive-integration.js";
import { resolveMediaCostAdmission } from "./media-cost-admission.js";

export const IMAGE_GENERATION_LIMITS = Object.freeze({
  timeoutMs: 45000,
  maxDataImageLength: 8 * 1024 * 1024,
  maxCount: 4,
  maxDimension: 8192,
  maxOutputUrlLength: 4000,
});

export class ImageGenerationGatewayError extends Error {
  constructor(message, code = "IMAGE_GENERATION_GATEWAY_ERROR", status = 502) {
    super(message);
    this.name = "ImageGenerationGatewayError";
    this.code = code;
    this.status = status;
  }
}

function cleanText(value, max = 2000) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function normalizeCostClass(value) {
  const costClass = String(value || "metered").trim().toLowerCase();
  return ["zero", "free", "metered"].includes(costClass) ? costClass : "metered";
}

function checkedEndpoint(value) {
  try { return assertRuntimeUrlAllowed(String(value || "").trim()); }
  catch (error) { throw new ImageGenerationGatewayError("The configured image runtime is not allowed.", "IMAGE_GENERATION_ENDPOINT_INVALID", error?.status || 500); }
}

function outputHostAllowlist() {
  const allow = new Set(String(process.env.IMAGE_GENERATION_OUTPUT_HOST_ALLOWLIST || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
  try {
    const endpoint = new URL(String(process.env.IMAGE_GENERATION_ENDPOINT || ""));
    if (endpoint.protocol === "https:") allow.add(endpoint.hostname.toLowerCase());
  } catch {}
  return allow;
}

export function isApprovedImageOutputUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > IMAGE_GENERATION_LIMITS.maxOutputUrlLength) return false;
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return outputHostAllowlist().has(url.hostname.toLowerCase());
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

function safeJson(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function normalizeGeneratedImageValue(value) {
  const raw = typeof value === "string" ? value : value?.image || value?.url || value?.imageUrl || value?.outputUrl || "";
  const image = String(raw || "").trim();
  if (!image) return null;
  if (/^https:\/\//i.test(image)) return isApprovedImageOutputUrl(image) ? image : null;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(image) && image.length <= IMAGE_GENERATION_LIMITS.maxDataImageLength) return image;
  return null;
}

function safeDimension(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= IMAGE_GENERATION_LIMITS.maxDimension ? n : null;
}

export function getImageGenerationConfig() {
  const provider = cleanText(process.env.IMAGE_GENERATION_PROVIDER || "", 80);
  const endpoint = String(process.env.IMAGE_GENERATION_ENDPOINT || "").trim();
  const costClass = normalizeCostClass(process.env.IMAGE_GENERATION_COST_CLASS);
  const connected = Boolean(provider && endpoint);
  const admission = resolveMediaCostAdmission({ kind: "image", provider, costClass, connected });
  return {
    provider: provider || "provider-neutral",
    endpoint: endpoint || null,
    costClass,
    costMode: admission.costMode,
    connected,
    configured: connected && admission.externalAllowed,
    blockedByCostPolicy: admission.blockedByCostPolicy,
    chargeRequired: admission.chargeRequired,
    zeroCostExecution: admission.zeroCostExecution,
    freeTierHardStopVerified: admission.freeTierHardStopVerified,
    admissionRoute: admission.route,
    admissionReason: admission.reason,
  };
}

export async function generateExternalImages({ prompt, mode, style, palette, count, colors = {} }) {
  const config = getImageGenerationConfig();
  const cognitive=createCognitiveEnvelope("ai-image",{
    goal:`Generate image output safely for mode ${cleanText(mode,40)||"image"}`,
    complexity:Math.min(1,.55+Math.max(1,Number(count)||1)*.04),
    uncertainty:{evidenceCoverage:config.configured?.55:.25,sourceAgreement:.5,testCoverage:.35,evidenceClass:"INTERNAL",externalVerificationRequired:config.configured},
  });
  const operationId=`image:${cleanText(mode,40)}:${cleanText(style,80)}:${Math.max(1,Number(count)||1)}:${config.provider}`;
  const startedAt=Date.now();
  recordCognitiveTelemetry({domain:"ai-image",phase:"gateway",envelope:cognitive,operationId,outcome:"planned",provider:config.provider});
  if (config.blockedByCostPolicy) {
    recordCognitiveTelemetry({domain:"ai-image",phase:"gateway",envelope:cognitive,operationId,outcome:"cost-policy-blocked",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new ImageGenerationGatewayError("Connected image generation is blocked by the active cost policy.", "IMAGE_GENERATION_COST_POLICY_BLOCKED", 403);
  }
  if (!config.configured) return { configured: false, generated: false, provider: null, images: [], admissionRoute: config.admissionRoute, cognitive };

  const endpoint = checkedEndpoint(config.endpoint);
  const headers = { "Content-Type": "application/json", Accept: "application/json", "X-LANERIQ-Cognitive-Mode":cognitive.reasoningMode, "X-LANERIQ-Evidence-Class":cognitive.evidenceClass };
  const token = String(process.env.IMAGE_GENERATION_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const timeout = withTimeout(IMAGE_GENERATION_LIMITS.timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        schemaVersion: 1,
        prompt: cleanText(prompt, 4000),
        mode: cleanText(mode, 40),
        style: cleanText(style, 80),
        palette: cleanText(palette, 80),
        count: Math.min(IMAGE_GENERATION_LIMITS.maxCount, Math.max(1, Number(count) || 1)),
        colors: {
          primary: cleanText(colors.primary, 16),
          accent: cleanText(colors.accent, 16),
          background: cleanText(colors.background, 16),
        },
        output: { formats: ["png", "webp"], textInImage: false },
      }),
      cache: "no-store",
      redirect: "error",
      signal: timeout.signal,
    });
  } catch (error) {
    recordCognitiveTelemetry({domain:"ai-image",phase:"provider",envelope:cognitive,operationId,outcome:error?.name==="AbortError"?"timeout":"unreachable",provider:config.provider,latencyMs:Date.now()-startedAt});
    if (error?.name === "AbortError") throw new ImageGenerationGatewayError("The connected image runtime timed out.", "IMAGE_GENERATION_TIMEOUT", 504);
    throw new ImageGenerationGatewayError("The connected image runtime is unavailable.", "IMAGE_GENERATION_UNREACHABLE", 503);
  } finally {
    timeout.done();
  }

  const raw = await response.text();
  const data = safeJson(raw);
  if (!response.ok) {
    recordCognitiveTelemetry({domain:"ai-image",phase:"provider",envelope:cognitive,operationId,outcome:"rejected",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new ImageGenerationGatewayError("The connected image runtime rejected the request.", cleanText(data?.code, 100) || "IMAGE_GENERATION_REJECTED", response.status >= 400 && response.status < 600 ? response.status : 502);
  }

  const candidates = Array.isArray(data?.images) ? data.images : Array.isArray(data?.outputs) ? data.outputs : [data?.image || data?.url].filter(Boolean);
  const images = candidates.slice(0, Math.min(IMAGE_GENERATION_LIMITS.maxCount, Math.max(1, Number(count) || 1))).map((item, index) => {
    const image = normalizeGeneratedImageValue(item);
    if (!image) return null;
    return {
      id: cleanText(item?.id, 120) || `generated-${index + 1}`,
      image,
      width: safeDimension(item?.width),
      height: safeDimension(item?.height),
    };
  }).filter(Boolean);
  if (!images.length) {
    recordCognitiveTelemetry({domain:"ai-image",phase:"provider",envelope:cognitive,operationId,outcome:"invalid-output",provider:config.provider,latencyMs:Date.now()-startedAt});
    throw new ImageGenerationGatewayError("The connected image runtime returned no usable approved image output.", "IMAGE_GENERATION_INVALID_RESPONSE", 502);
  }
  recordCognitiveTelemetry({domain:"ai-image",phase:"provider",envelope:cognitive,operationId,outcome:"completed",provider:config.provider,latencyMs:Date.now()-startedAt});
  return { configured: true, generated: true, provider: config.provider, images, admissionRoute: config.admissionRoute, chargeRequired: config.chargeRequired, zeroCostExecution: config.zeroCostExecution, cognitive };
}
