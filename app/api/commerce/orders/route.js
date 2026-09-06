import { NextResponse } from "next/server";
import { getBuilderPrincipal } from "../../../../lib/cloud/builder-projects.js";
import { createAdminClient } from "../../../../lib/supabase/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET() {
  try {
    const principal = await getBuilderPrincipal({ requireVerified: true });
    if (!principal.ok) {
      const verification = principal.code === "ACCOUNT_VERIFICATION_REQUIRED";
      return privateJson({ success: false, error: verification ? "Account verification is required." : "Authentication required." }, verification ? 403 : 401);
    }
    const userId = principal.principal.principalId;
    const admin = createAdminClient();
    const [orders, refunds] = await Promise.all([
      admin
        .from("platform_payment_orders")
        .select("id,offer_code,expected_amount_minor,currency,status,paid_at,reversed_at,reconciliation_required,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("platform_refund_requests")
        .select("id,order_id,status,provider_refund_status,requested_at,reviewed_at,provider_submitted_at,completed_at,updated_at")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(50),
    ]);
    if (orders.error || refunds.error) throw new Error("Billing history query failed.");
    return privateJson({ success: true, orders: orders.data || [], refunds: refunds.data || [] });
  } catch (error) {
    console.error("PLATFORM_BILLING_HISTORY_ERROR", error?.name || "Error");
    return privateJson({ success: false, error: "Billing history is temporarily unavailable." }, 500);
  }
}
