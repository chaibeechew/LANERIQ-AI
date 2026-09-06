import assert from "node:assert/strict";
import fs from "node:fs";
import { COMMERCIAL_OFFERS } from "../config/commercial-offers.js";

const read = (path) => fs.readFileSync(path, "utf8");
const checkout = read("app/api/commerce/checkout/route.js");
const webhook = read("app/api/commerce/stripe/webhook/route.js");
const customerRefund = read("app/api/commerce/refunds/route.js");
const adminRefund = read("app/api/admin/commerce/refunds/[id]/execute/route.js");
const stripe = read("lib/commerce/stripe-platform.js");
const refunds = read("lib/commerce/refunds.js");
const migration = read("supabase/migrations/20260906093000_platform_commerce_payment_closure.sql");
const refundMigration = read("supabase/migrations/20260906094000_platform_commerce_refund_requests.sql");
const billing = read("app/billing/page.js");

assert.equal(COMMERCIAL_OFFERS.standard.amountMinor, 1000);
assert.equal(COMMERCIAL_OFFERS.professional.amountMinor, 6800);
assert.equal(COMMERCIAL_OFFERS.full_access.amountMinor, 19900);
assert.equal(COMMERCIAL_OFFERS.professional.checkoutMode, "payment", "Professional is one payment for 12 months, not an auto-renewing subscription.");
assert.equal(COMMERCIAL_OFFERS.full_access.checkoutMode, "payment", "Full Access is one payment for 12 months, not an auto-renewing subscription.");

for (const pattern of [/getBuilderPrincipal\(\{ requireVerified: true \}\)/,/STRIPE_SECRET_KEY/,/Idempotency-Key/,/offerCode/]) assert.match(checkout, pattern);
assert.doesNotMatch(checkout, /amountMinor\s*=\s*body|amount\s*=\s*body/i, "Checkout must not accept a client-selected amount.");

for (const pattern of [/stripe-signature/i,/verifyStripeWebhook/,/request\.text\(\)/,/applyStripeWebhookEvent/,/MAX_WEBHOOK_BYTES/]) assert.match(webhook, pattern);
assert.ok(webhook.indexOf("verifyStripeWebhook") < webhook.indexOf("JSON.parse(rawBody)"), "Signature verification must happen before webhook JSON is trusted.");

for (const pattern of [/timingSafeEqual/,/createHmac\("sha256"/,/STRIPE_WEBHOOK_SECRET/,/metadata\[laneriq_order_id\]/,/payment_intent_data\[metadata\]\[laneriq_order_id\]/,/invoice_creation\[enabled\]/,/server_apply_platform_payment_event/,/payloadSha256/]) assert.match(stripe, pattern);
assert.doesNotMatch(stripe, /NEXT_PUBLIC_.*STRIPE|STRIPE_SECRET_KEY.*NEXT_PUBLIC/i, "Stripe secrets must remain server-only.");

for (const pattern of [/create table if not exists public\.platform_payment_orders/,/create table if not exists public\.platform_payment_events/,/create table if not exists public\.platform_access_grants/,/enable row level security/,/revoke all on public\.platform_payment_events from public, anon, authenticated/,/grant execute on function public\.server_apply_platform_payment_event[\s\S]*to service_role/,/payload_sha256/,/expected_amount_minor/,/amount_mismatch/,/currency_mismatch/,/unique\(provider, provider_event_id\)/,/reconciliation_required/]) assert.match(migration, pattern);
assert.doesNotMatch(migration, /grant execute[\s\S]{0,180}authenticated/i, "Payment-application RPC must not be client-callable.");

for (const pattern of [/create table if not exists public\.platform_refund_requests/,/enable row level security/,/revoke all on public\.platform_refund_requests from public, anon, authenticated/,/grant select on public\.platform_refund_requests to authenticated/,/pending_review/,/provider_submitted/,/provider_failed/]) assert.match(refundMigration, pattern);
assert.doesNotMatch(refundMigration, /grant (insert|update|delete).*authenticated/i, "Customers must not directly mutate refund financial state.");

for (const pattern of [/getBuilderPrincipal\(\{ requireVerified: true \}\)/,/requestPlatformRefund/,/platform_refund_requests/,/Submission does not guarantee eligibility/]) assert.match(customerRefund, pattern);
for (const pattern of [/resolveLaneriqAdminRequest/,/executeApprovedPlatformRefund/,/signed provider reconciliation events/]) assert.match(adminRefund, pattern);
for (const pattern of [/Idempotency-Key.*platform-refund/s,/payment_intent/,/provider_pending/,/provider_failed/,/platform_refund_requests/,/platform_payment_orders/]) assert.match(refunds, pattern);
assert.doesNotMatch(customerRefund, /STRIPE_SECRET_KEY/, "Customer refund endpoint must not handle provider secrets.");
assert.doesNotMatch(refunds, /NEXT_PUBLIC_.*STRIPE/i, "Refund provider secrets must remain server-only.");

assert.match(billing, /signed payment-provider event/i);
assert.match(billing, /Apple and Google fees are paid directly/i);

console.log("commercial payment closure contracts: PASS");
