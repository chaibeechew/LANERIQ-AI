import { NextResponse } from "next/server";
import { resolveLaneriqAdminRequest } from "../../../../../../../lib/auth/admin-authority.js";
import { executeApprovedPlatformRefund } from "../../../../../../../lib/commerce/refunds.js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large."), { status: 413 });
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

export async function POST(request, { params }) {
  try {
    const authority = await resolveLaneriqAdminRequest(request);
    if (!authority.ok) return privateJson({ success: false, error: authority.error }, authority.status);

    const { id } = await params;
    const refundRequestId = String(id || "").trim();
    if (!UUID.test(refundRequestId)) return privateJson({ success: false, error: "A valid refund request is required." }, 400);
    const body = await readBody(request);

    const provider = await executeApprovedPlatformRefund({
      adminUserId: authority.userId,
      refundRequestId,
      adminNote: body?.note,
    });

    return privateJson({
      success: true,
      refund: {
        providerStatus: provider.status,
        replayed: provider.replayed === true,
      },
      message: "Refund was submitted to the payment provider. Paid access is reversed only from signed provider reconciliation events.",
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if ([400, 413].includes(status)) return privateJson({ success: false, error: error.message }, status);
    console.error("ADMIN_PLATFORM_REFUND_EXECUTION_ERROR", error?.code || error?.name || "Error");
    return privateJson({ success: false, error: "Refund could not be submitted safely. Check the review ledger before retrying." }, 500);
  }
}
