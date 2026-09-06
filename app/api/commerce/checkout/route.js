import { NextResponse } from "next/server";
import { getBuilderPrincipal } from "../../../../lib/cloud/builder-projects.js";
import { createPlatformCheckout } from "../../../../lib/commerce/stripe-platform.js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;
const REQUEST_KEY = /^[A-Za-z0-9._:-]{1,160}$/;
const OFFER_CODE = /^(standard|professional|full_access)$/;

function privateJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

function checkoutOrigin(request) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return configured || new URL(request.url).origin;
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

export async function POST(request) {
  try {
    if (!String(process.env.STRIPE_SECRET_KEY || "").trim()) {
      return privateJson({ success: false, error: "Managed Payments is not configured yet." }, 503);
    }

    const principal = await getBuilderPrincipal({ requireVerified: true });
    if (!principal.ok) {
      const verifiedFailure = principal.code === "ACCOUNT_VERIFICATION_REQUIRED";
      return privateJson(
        { success: false, error: verifiedFailure ? "Account verification is required." : "Authentication required." },
        verifiedFailure ? 403 : 401,
      );
    }

    const body = await readBody(request);
    const offerCode = String(body?.offerCode || "").trim().toLowerCase();
    const requestKey = String(body?.requestId || request.headers.get("idempotency-key") || "").trim();
    if (!OFFER_CODE.test(offerCode)) return privateJson({ success: false, error: "A valid commercial offer is required." }, 400);
    if (!REQUEST_KEY.test(requestKey)) return privateJson({ success: false, error: "A stable checkout request ID is required." }, 400);

    const checkout = await createPlatformCheckout({
      userId: principal.principal.principalId,
      offerCode,
      requestKey,
      origin: checkoutOrigin(request),
    });

    return privateJson({
      success: true,
      orderId: checkout.orderId,
      checkoutId: checkout.checkoutId,
      url: checkout.url,
      replayed: checkout.replayed === true,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status === 400 || status === 413) return privateJson({ success: false, error: error.message }, status);
    console.error("PLATFORM_CHECKOUT_ERROR", error?.code || error?.name || "Error");
    return privateJson({ success: false, error: "Unable to start payment checkout safely." }, 500);
  }
}
