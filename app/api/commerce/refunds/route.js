import { NextResponse } from "next/server";
import { getBuilderPrincipal } from "../../../../lib/cloud/builder-projects.js";
import { createAdminClient } from "../../../../lib/supabase/admin.js";
import { requestPlatformRefund } from "../../../../lib/commerce/refunds.js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;

function privateJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

async function verifiedPrincipal() {
  const principal = await getBuilderPrincipal({ requireVerified: true });
  if (principal.ok) return principal;
  const verification = principal.code === "ACCOUNT_VERIFICATION_REQUIRED";
  throw Object.assign(new Error(verification ? "Account verification is required." : "Authentication required."), { status: verification ? 403 : 401 });
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

export async function GET() {
  try {
    const principal = await verifiedPrincipal();
    const userId = principal.principal.principalId;
    const admin = createAdminClient();
    const result = await admin
      .from("platform_refund_requests")
      .select("id,order_id,status,provider_refund_status,requested_at,reviewed_at,provider_submitted_at,completed_at,updated_at")
      .eq("user_id", userId)
      .order("requested_at", { ascending: false })
      .limit(50);
    if (result.error) throw new Error("Refund history is unavailable.");
    return privateJson({ success: true, refunds: result.data || [] });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if ([401, 403].includes(status)) return privateJson({ success: false, error: error.message }, status);
    console.error("PLATFORM_REFUND_LIST_ERROR", error?.name || "Error");
    return privateJson({ success: false, error: "Unable to load refund status." }, 500);
  }
}

export async function POST(request) {
  try {
    const principal = await verifiedPrincipal();
    const body = await readBody(request);
    const refund = await requestPlatformRefund({
      userId: principal.principal.principalId,
      orderId: body?.orderId,
      reason: body?.reason,
    });
    return privateJson({
      success: true,
      refund: {
        id: refund.id,
        orderId: refund.order_id,
        status: refund.status,
        requestedAt: refund.requested_at,
        replayed: refund.replayed === true,
      },
      message: "Refund request submitted for review. Submission does not guarantee eligibility or immediate bank settlement.",
    }, refund.replayed ? 200 : 202);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if ([400, 401, 403, 413].includes(status)) return privateJson({ success: false, error: error.message }, status);
    const message = String(error?.message || "");
    if (/valid payment order|short refund reason|paid order not found|completed paid order/.test(message.toLowerCase())) {
      return privateJson({ success: false, error: message }, 400);
    }
    console.error("PLATFORM_REFUND_REQUEST_ERROR", error?.name || "Error");
    return privateJson({ success: false, error: "Unable to submit refund request safely." }, 500);
  }
}
