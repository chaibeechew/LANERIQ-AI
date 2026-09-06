import { NextResponse } from "next/server";

const MAX_MUTATION_BODY_BYTES = 256 * 1024;

export function controlTowerJson(payload, status = 200, extraHeaders = {}) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      Vary: "Cookie",
      ...extraHeaders,
    },
  });
}

export function controlTowerAuthErrorResponse(auth) {
  return controlTowerJson({ error: auth.message, code: auth.code }, auth.status);
}

export function assertControlTowerMutationOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return { ok: false, status: 403, code: "ORIGIN_REQUIRED", message: "Mutation origin is required." };
  }

  let normalizedOrigin;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return { ok: false, status: 403, code: "INVALID_ORIGIN", message: "Mutation origin is invalid." };
  }

  if (normalizedOrigin !== request.nextUrl.origin) {
    return { ok: false, status: 403, code: "ORIGIN_MISMATCH", message: "Cross-origin Control Tower mutations are not allowed." };
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    return { ok: false, status: 403, code: "FETCH_SITE_BLOCKED", message: "Cross-site Control Tower mutations are not allowed." };
  }

  return { ok: true };
}

export function assertControlTowerMutationEnvelope(request) {
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_MUTATION_BODY_BYTES) {
    return { ok: false, status: 413, code: "BODY_TOO_LARGE", message: "Control Tower mutation body is too large." };
  }

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return { ok: false, status: 415, code: "JSON_REQUIRED", message: "Control Tower mutations require application/json." };
  }

  return { ok: true };
}

export function controlTowerMutationGuard(request) {
  for (const check of [assertControlTowerMutationOrigin(request), assertControlTowerMutationEnvelope(request)]) {
    if (!check.ok) return controlTowerJson({ error: check.message, code: check.code }, check.status);
  }
  return null;
}
