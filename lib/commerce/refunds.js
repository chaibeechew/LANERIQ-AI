import { createAdminClient } from "../supabase/admin.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRIPE_API = "https://api.stripe.com/v1";

function uuid(value) {
  const text = String(value || "").trim();
  if (!UUID.test(text)) throw new Error("A valid payment order is required.");
  return text;
}

function cleanReason(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (text.length < 3) throw new Error("Please provide a short refund reason.");
  return text;
}

function stripeSecret() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Managed Payments is not configured.");
  return key;
}

async function stripeRefund({ paymentIntentId, refundRequestId }) {
  const paymentIntent = String(paymentIntentId || "").trim();
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntent)) throw new Error("The paid order has no refundable provider payment reference yet.");
  const form = new URLSearchParams();
  form.set("payment_intent", paymentIntent);
  form.set("metadata[laneriq_refund_request_id]", refundRequestId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${STRIPE_API}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `laneriq:platform-refund:${refundRequestId}`,
      },
      body: form.toString(),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.id) {
      const error = new Error("Payment provider refund request failed.");
      error.code = String(data?.error?.code || `stripe_http_${response.status}`).slice(0, 100);
      throw error;
    }
    return { id: String(data.id), status: String(data.status || "pending") };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestPlatformRefund({ userId, orderId, reason }) {
  const uid = uuid(userId);
  const order = uuid(orderId);
  const normalizedReason = cleanReason(reason);
  const admin = createAdminClient();

  const orderResult = await admin
    .from("platform_payment_orders")
    .select("id,user_id,offer_code,status,paid_at,provider_payment_intent_id")
    .eq("id", order)
    .eq("user_id", uid)
    .maybeSingle();
  if (orderResult.error) throw new Error("Unable to verify the payment order.");
  if (!orderResult.data) throw new Error("Paid order not found.");
  if (orderResult.data.status !== "paid") throw new Error("Only a completed paid order can be submitted for refund review.");

  const inserted = await admin
    .from("platform_refund_requests")
    .insert({ order_id: order, user_id: uid, reason: normalizedReason, status: "pending_review" })
    .select("id,order_id,status,requested_at")
    .single();

  if (!inserted.error) return Object.freeze({ ...inserted.data, replayed: false });
  if (inserted.error.code !== "23505") throw new Error("Unable to submit refund request safely.");

  const existing = await admin
    .from("platform_refund_requests")
    .select("id,order_id,status,requested_at")
    .eq("order_id", order)
    .in("status", ["pending_review", "approved", "provider_pending", "provider_submitted", "provider_failed"])
    .maybeSingle();
  if (existing.error || !existing.data) throw new Error("Unable to recover the existing refund request.");
  return Object.freeze({ ...existing.data, replayed: true });
}

export async function executeApprovedPlatformRefund({ adminUserId, refundRequestId, adminNote = null }) {
  const administrator = uuid(adminUserId);
  const requestId = uuid(refundRequestId);
  const admin = createAdminClient();

  const loaded = await admin
    .from("platform_refund_requests")
    .select("id,order_id,user_id,status,provider_refund_id,platform_payment_orders!inner(id,status,provider_payment_intent_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (loaded.error || !loaded.data) throw new Error("Refund request not found.");
  const request = loaded.data;
  const order = Array.isArray(request.platform_payment_orders) ? request.platform_payment_orders[0] : request.platform_payment_orders;
  if (!order || order.status !== "paid") throw new Error("The payment order is not in a refundable paid state.");
  if (request.provider_refund_id) return Object.freeze({ id: request.provider_refund_id, status: request.status, replayed: true });
  if (!["pending_review", "approved", "provider_failed"].includes(request.status)) throw new Error("Refund request is not available for provider execution.");

  const claimed = await admin
    .from("platform_refund_requests")
    .update({
      status: "provider_pending",
      admin_user_id: administrator,
      admin_note: String(adminNote || "").trim().slice(0, 1000) || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .in("status", ["pending_review", "approved", "provider_failed"])
    .is("provider_refund_id", null)
    .select("id")
    .maybeSingle();
  if (claimed.error) throw new Error("Unable to claim refund execution safely.");
  if (!claimed.data) {
    const replay = await admin.from("platform_refund_requests").select("provider_refund_id,status").eq("id", requestId).maybeSingle();
    if (replay.data?.provider_refund_id) return Object.freeze({ id: replay.data.provider_refund_id, status: replay.data.status, replayed: true });
    throw new Error("Refund request changed while it was being processed. Retry after checking its current status.");
  }

  try {
    const provider = await stripeRefund({ paymentIntentId: order.provider_payment_intent_id, refundRequestId: requestId });
    const submitted = await admin
      .from("platform_refund_requests")
      .update({
        status: "provider_submitted",
        provider_refund_id: provider.id,
        provider_refund_status: provider.status,
        provider_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "provider_pending")
      .select("id,status,provider_refund_id,provider_refund_status")
      .single();
    if (submitted.error) throw new Error("Provider accepted the refund but LANERIQ could not persist its receipt. Manual reconciliation is required.");
    return Object.freeze({ id: provider.id, status: provider.status, replayed: false });
  } catch (error) {
    await admin
      .from("platform_refund_requests")
      .update({ status: "provider_failed", provider_refund_status: String(error?.code || "provider_error").slice(0, 120), updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", "provider_pending");
    throw error;
  }
}
