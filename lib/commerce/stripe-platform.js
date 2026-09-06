import crypto from "node:crypto";
import { createAdminClient } from "../supabase/admin.js";
import { getCommercialOffer } from "../../config/commercial-offers.js";

const REQUEST_KEY = /^[A-Za-z0-9._:-]{1,160}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRIPE_API = "https://api.stripe.com/v1";

function stripeSecret() {
  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Managed Payments is not configured.");
  return secret;
}

function safeRequestKey(value) {
  const key = String(value || "").trim();
  if (!REQUEST_KEY.test(key)) throw new Error("A stable checkout request ID is required.");
  return key;
}

function safeOrigin(value) {
  const url = new URL(String(value || ""));
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
  if (url.protocol !== "https:" && !local) throw new Error("A secure checkout origin is required.");
  return url.origin;
}

async function stripeFetch(path, { method = "GET", body = null, idempotencyKey = null } = {}) {
  const headers = { Authorization: `Bearer ${stripeSecret()}` };
  if (body !== null) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers,
      body: body === null ? undefined : body,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("Payment provider request failed.");
      error.code = String(data?.error?.code || `stripe_http_${response.status}`).slice(0, 100);
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function loadOrCreateOrder({ userId, offer, requestKey }) {
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    offer_code: offer.code,
    request_key: requestKey,
    provider: "stripe",
    expected_amount_minor: offer.amountMinor,
    currency: offer.currency.toUpperCase(),
    status: "pending",
  };
  const inserted = await admin.from("platform_payment_orders").insert(row).select("*").single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== "23505") throw new Error("Unable to reserve checkout safely.");

  const existing = await admin
    .from("platform_payment_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("request_key", requestKey)
    .maybeSingle();
  if (existing.error || !existing.data) throw new Error("Unable to recover checkout reservation.");
  if (
    existing.data.offer_code !== offer.code ||
    Number(existing.data.expected_amount_minor) !== Number(offer.amountMinor) ||
    existing.data.currency !== offer.currency.toUpperCase()
  ) {
    throw new Error("Checkout request ID is already bound to a different offer.");
  }
  return existing.data;
}

async function recoverOpenSession(order) {
  const id = String(order?.provider_checkout_session_id || "").trim();
  if (!id) return null;
  const session = await stripeFetch(`/checkout/sessions/${encodeURIComponent(id)}`);
  if (!session?.url || session?.status === "complete" || session?.status === "expired") return null;
  return session;
}

export async function createPlatformCheckout({ userId, offerCode, requestKey, origin }) {
  if (!UUID.test(String(userId || ""))) throw new Error("Verified account identity is required.");
  const offer = getCommercialOffer(offerCode);
  if (!offer) throw new Error("This commercial offer is not available for checkout.");
  if (offer.checkoutMode !== "payment") throw new Error("Unsupported checkout mode.");
  const stableKey = safeRequestKey(requestKey);
  const safeAppOrigin = safeOrigin(origin);
  const order = await loadOrCreateOrder({ userId, offer, requestKey: stableKey });

  if (["paid", "refunded", "disputed", "reconciliation_required"].includes(order.status)) {
    throw new Error("This checkout request has already reached a terminal payment state.");
  }

  if (order.provider_checkout_session_id) {
    const recovered = await recoverOpenSession(order);
    if (recovered) {
      return Object.freeze({
        orderId: order.id,
        checkoutId: recovered.id,
        url: recovered.url,
        replayed: true,
      });
    }
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${safeAppOrigin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${safeAppOrigin}/billing?checkout=cancel`);
  form.set("client_reference_id", userId);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", offer.currency);
  form.set("line_items[0][price_data][unit_amount]", String(offer.amountMinor));
  form.set("line_items[0][price_data][product_data][name]", offer.name);
  form.set("line_items[0][price_data][product_data][description]", offer.description);
  form.set("invoice_creation[enabled]", "true");
  form.set("metadata[laneriq_order_id]", order.id);
  form.set("metadata[laneriq_offer_code]", offer.code);
  form.set("payment_intent_data[metadata][laneriq_order_id]", order.id);
  form.set("payment_intent_data[metadata][laneriq_offer_code]", offer.code);
  form.set("payment_intent_data[metadata][laneriq_user_id]", userId);

  const session = await stripeFetch("/checkout/sessions", {
    method: "POST",
    body: form.toString(),
    idempotencyKey: `laneriq:platform-checkout:${order.id}`,
  });
  if (!session?.id || !session?.url) throw new Error("Payment provider returned an incomplete checkout session.");

  const admin = createAdminClient();
  const updated = await admin
    .from("platform_payment_orders")
    .update({ provider_checkout_session_id: session.id, status: "checkout_created", updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (updated.error) throw new Error("Checkout was created but could not be bound to its server order. Retry with the same request ID.");

  return Object.freeze({ orderId: order.id, checkoutId: session.id, url: session.url, replayed: false });
}

function parseStripeSignature(header) {
  const values = String(header || "").split(",");
  const timestamps = [];
  const signatures = [];
  for (const item of values) {
    const [key, value] = item.trim().split("=", 2);
    if (key === "t" && /^\d+$/.test(value || "")) timestamps.push(Number(value));
    if (key === "v1" && /^[0-9a-f]{64}$/i.test(value || "")) signatures.push(value.toLowerCase());
  }
  return { timestamp: timestamps[0] || 0, signatures };
}

export function verifyStripeWebhook(rawBody, signatureHeader, { nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300 } = {}) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("Stripe webhook verification is not configured.");
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new Error("Stripe webhook signature is invalid or expired.");
  }
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((candidate) => {
    const supplied = Buffer.from(candidate, "hex");
    return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
  });
  if (!valid) throw new Error("Stripe webhook signature verification failed.");
  return true;
}

function uuidOrNull(value) {
  const text = String(value || "").trim();
  return UUID.test(text) ? text : null;
}

function textId(value) {
  return typeof value === "string" ? value.trim().slice(0, 255) : "";
}

function eventFields(event) {
  const object = event?.data?.object || {};
  const metadata = object?.metadata || {};
  const type = String(event?.type || "").trim();
  const orderId = uuidOrNull(metadata?.laneriq_order_id);
  let checkoutSessionId = type.startsWith("checkout.session.") ? textId(object?.id) : "";
  let paymentIntentId = textId(object?.payment_intent);
  if (type.startsWith("payment_intent.")) paymentIntentId = textId(object?.id);
  if (type.startsWith("charge.")) paymentIntentId = textId(object?.payment_intent);
  const paymentStatus = textId(object?.payment_status || object?.status).toLowerCase();
  const amountMinor = Number.isSafeInteger(Number(object?.amount_total)) ? Number(object.amount_total) : null;
  const currency = /^[a-z]{3}$/i.test(String(object?.currency || "")) ? String(object.currency).toUpperCase() : null;
  return { orderId, checkoutSessionId: checkoutSessionId || null, paymentIntentId: paymentIntentId || null, paymentStatus: paymentStatus || null, amountMinor, currency };
}

export async function applyStripeWebhookEvent(event, rawBody) {
  const eventId = textId(event?.id);
  const eventType = String(event?.type || "").trim().slice(0, 160);
  if (!eventId || !eventType) throw new Error("Stripe event identity is incomplete.");
  const payloadSha256 = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  const fields = eventFields(event);
  const providerCreatedAt = Number.isFinite(Number(event?.created))
    ? new Date(Number(event.created) * 1000).toISOString()
    : null;
  const admin = createAdminClient();
  const result = await admin.rpc("server_apply_platform_payment_event", {
    p_provider_event_id: eventId,
    p_event_type: eventType,
    p_order_id: fields.orderId,
    p_checkout_session_id: fields.checkoutSessionId,
    p_payment_intent_id: fields.paymentIntentId,
    p_payment_status: fields.paymentStatus,
    p_amount_minor: fields.amountMinor,
    p_currency: fields.currency,
    p_provider_created_at: providerCreatedAt,
    p_payload_sha256: payloadSha256,
  });
  if (result.error) throw new Error("Payment event could not be applied safely.");
  return result.data || { ok: true, status: "processed" };
}
