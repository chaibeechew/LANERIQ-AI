import assert from "node:assert/strict";
import fs from "node:fs";
import { COMMERCIAL_OFFERS } from "../config/commercial-offers.js";

const read = (path) => fs.readFileSync(path, "utf8");
const checkout = read("app/api/commerce/checkout/route.js");
const webhook = read("app/api/commerce/stripe/webhook/route.js");
const stripe = read("lib/commerce/stripe-platform.js");
const migration = read("supabase/migrations/20260906093000_platform_commerce_payment_closure.sql");
const billing = read("app/billing/page.js");

assert.equal(COMMERCIAL_OFFERS.standard.amountMinor, 1000);
assert.equal(COMMERCIAL_OFFERS.professional.amountMinor, 6800);
assert.equal(COMMERCIAL_OFFERS.full_access.amountMinor, 19900);
assert.equal(COMMERCIAL_OFFERS.professional.checkoutMode, "payment", "Professional is one payment for 12 months, not an auto-renewing subscription.");
assert.equal(COMMERCIAL_OFFERS.full_access.checkoutMode, "payment", "Full Access is one payment for 12 months, not an auto-renewing subscription.");

for (const pattern of [
  /getBuilderPrincipal\(\{ requireVerified: true \}\)/,
  /STRIPE_SECRET_KEY/,
  /Idempotency-Key/,
  /offerCode/,
]) assert.match(checkout, pattern);
assert.doesNotMatch(checkout, /amountMinor\s*=\s*body|amount\s*=\s*body/i, "Checkout must not accept a client-selected amount.");

for (const pattern of [
  /stripe-signature/i,
  /verifyStripeWebhook/,
  /request\.text\(\)/,
  /applyStripeWebhookEvent/,
  /MAX_WEBHOOK_BYTES/,
]) assert.match(webhook, pattern);
assert.ok(webhook.indexOf("verifyStripeWebhook") < webhook.indexOf("JSON.parse(rawBody)"), "Signature verification must happen before webhook JSON is trusted.");

for (const pattern of [
  /timingSafeEqual/,
  /createHmac\("sha256"/,
  /STRIPE_WEBHOOK_SECRET/,
  /metadata\[laneriq_order_id\]/,
  /payment_intent_data\[metadata\]\[laneriq_order_id\]/,
  /invoice_creation\[enabled\]/,
  /server_apply_platform_payment_event/,
  /payloadSha256/,
]) assert.match(stripe, pattern);
assert.doesNotMatch(stripe, /NEXT_PUBLIC_.*STRIPE|STRIPE_SECRET_KEY.*NEXT_PUBLIC/i, "Stripe secrets must remain server-only.");

for (const pattern of [
  /create table if not exists public\.platform_payment_orders/,
  /create table if not exists public\.platform_payment_events/,
  /create table if not exists public\.platform_access_grants/,
  /enable row level security/,
  /revoke all on public\.platform_payment_events from public, anon, authenticated/,
  /grant execute on function public\.server_apply_platform_payment_event[\s\S]*to service_role/,
  /payload_sha256/,
  /expected_amount_minor/,
  /amount_mismatch/,
  /currency_mismatch/,
  /unique\(provider, provider_event_id\)/,
  /reconciliation_required/,
]) assert.match(migration, pattern);
assert.doesNotMatch(migration, /grant execute[\s\S]{0,180}authenticated/i, "Payment-application RPC must not be client-callable.");

assert.match(billing, /server.*signed payment-provider event|signed payment-provider event/i);
assert.match(billing, /Apple and Google fees are paid directly/i);

console.log("commercial payment closure contracts: PASS");
