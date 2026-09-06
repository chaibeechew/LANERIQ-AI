import { NextResponse } from "next/server";
import { applyStripeWebhookEvent, verifyStripeWebhook } from "../../../../../lib/commerce/stripe-platform.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 1024 * 1024;

function reply(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request) {
  try {
    const declared = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) {
      return reply({ received: false, error: "Webhook payload too large." }, 413);
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return reply({ received: false, error: "Webhook payload too large." }, 413);
    }

    const signature = request.headers.get("stripe-signature");
    try {
      verifyStripeWebhook(rawBody, signature);
    } catch {
      return reply({ received: false, error: "Invalid webhook signature." }, 400);
    }

    let event;
    try { event = JSON.parse(rawBody); }
    catch { return reply({ received: false, error: "Invalid webhook payload." }, 400); }

    const result = await applyStripeWebhookEvent(event, rawBody);
    return reply({
      received: true,
      processingStatus: String(result?.status || "processed"),
      replayed: result?.replayed === true,
      reconciliationRequired: result?.reconciliationRequired === true,
    });
  } catch (error) {
    console.error("STRIPE_WEBHOOK_APPLY_ERROR", error?.name || "Error");
    return reply({ received: false, error: "Webhook could not be persisted safely." }, 500);
  }
}
