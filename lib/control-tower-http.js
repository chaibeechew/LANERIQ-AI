import { NextResponse } from "next/server";

export function controlTowerJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
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
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return { ok: false, status: 403, code: "FETCH_SITE_BLOCKED", message: "Cross-site Control Tower mutations are not allowed." };
  }

  return { ok: true };
}

export function controlTowerMutationGuard(request) {
  const result = assertControlTowerMutationOrigin(request);
  return result.ok ? null : controlTowerJson({ error: result.message, code: result.code }, result.status);
}
