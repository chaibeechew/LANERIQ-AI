import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {CUSTOMER_PAYMENT_CONNECT_POLICY,normalizeConnectSetupInput,getCustomerPaymentConnectRuntime} from '../config/customer-payment-connect-policy.js';
import {normalizeStripeMerchantStatus,verifyStripeConnectWebhookSignature} from '../lib/payments/stripe-connect.js';

assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.platformModel,'saas_direct_charges');
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.merchantOfRecord,'connected_customer');
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.feesCollector,'stripe');
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.lossesCollector,'stripe');
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.laneriqTransactionFeePercent,0);
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.sensitiveKycStoredByLaneriq,false);
assert.equal(CUSTOMER_PAYMENT_CONNECT_POLICY.rawBankDetailsStoredByLaneriq,false);
assert.deepEqual(normalizeConnectSetupInput({country:'MY',displayName:'  Example   Studio '}),{appId:null,displayName:'Example Studio',country:'my',locale:'en-US'});
assert.throws(()=>normalizeConnectSetupInput({country:'MYS'}));

const active=normalizeStripeMerchantStatus({id:'acct_Test123',livemode:false,configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}},requirements:{summary:{minimum_deadline:null}},future_requirements:{summary:{minimum_deadline:null}}});
assert.equal(active.readyForPayments,true);assert.equal(active.onboardingState,'ready');
const restricted=normalizeStripeMerchantStatus({id:'acct_Test456',livemode:false,configuration:{merchant:{capabilities:{card_payments:{status:'restricted'}}}},requirements:{summary:{minimum_deadline:{status:'currently_due',time:'2026-09-10T00:00:00Z'}}}});
assert.equal(restricted.readyForPayments,false);assert.equal(restricted.onboardingState,'action_required');

const raw=JSON.stringify({id:'evt_test',type:'v2.core.account[requirements].updated',livemode:false,related_object:{id:'acct_Test123',type:'v2.core.account'}});const timestamp=1700000000,secret='whsec_contract_only';const sig=crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');assert.equal(verifyStripeConnectWebhookSignature(raw,`t=${timestamp},v1=${sig}`,{secret,nowSeconds:timestamp}).verified,true);assert.throws(()=>verifyStripeConnectWebhookSignature(raw,`t=${timestamp},v1=${'0'.repeat(64)}`,{secret,nowSeconds:timestamp}));

process.env.STRIPE_CONNECT_ENABLED='true';process.env.STRIPE_SECRET_KEY='sk_test_contract_only';process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_test_contract_only';assert.equal(getCustomerPaymentConnectRuntime().configured,true);assert.equal(getCustomerPaymentConnectRuntime().live,false);

const adapter=fs.readFileSync('lib/payments/stripe-connect.js','utf8');const accountRoute=fs.readFileSync('app/api/payments/connect/account/route.js','utf8');const sessionRoute=fs.readFileSync('app/api/payments/connect/account-session/route.js','utf8');const webhook=fs.readFileSync('app/api/payments/connect/webhook/route.js','utf8');const client=fs.readFileSync('app/payments/connect/ConnectOnboardingClient.js','utf8');const migration=fs.readFileSync('supabase/migrations/20260906051000_customer_payment_connect_autopilot.sql','utf8');const nextConfig=fs.readFileSync('next.config.mjs','utf8');
for(const pattern of [/\/v2\/core\/accounts/,/configuration:\{merchant:/,/card_payments/,/fees_collector:'stripe'/,/losses_collector:'stripe'/,/\/v1\/account_sessions/,/account_onboarding/,/notification_banner/,/balances/,/payouts/])assert.match(adapter,pattern);
assert.doesNotMatch(adapter,/application_fee_amount|destination_charges|separate_charges/i);
for(const pattern of [/auth\.getUser\(\)/,/email_confirmed_at/,/Trusted same-origin request required/,/\.eq\('owner_id',\s*user\.id\)/,/sensitiveKycStoredByLaneriq:\s*false/])assert.match(accountRoute,pattern);
for(const pattern of [/Trusted same-origin request required/,/Stripe Connect environment mismatch/,/clientSecret/,/publishableKey/])assert.match(sessionRoute,pattern);
for(const pattern of [/stripe-signature/,/v2\.core\.account/,/retrieveStripeConnectedMerchant/,/unmapped_account/])assert.match(webhook,pattern);
for(const pattern of [/connect-js\.stripe\.com\/v1\.0\/connect\.js/,/account-onboarding/,/notification-banner/,/balances/,/payouts/,/never stores your identity documents or raw bank details/i])assert.match(client,pattern);
for(const pattern of [/customer_payment_connect_accounts/,/customer_payment_connect_events/,/enable row level security/,/grant select on public\.customer_payment_connect_accounts to authenticated/,/grant all on public\.customer_payment_connect_accounts,public\.customer_payment_connect_events to service_role/,/auth\.uid\(\).*user_id/])assert.match(migration,pattern);
for(const forbidden of [/\bssn\b/i,/passport_number/i,/bank_account_number/i,/identity_document_blob/i,/beneficial_owner_document/i])assert.doesNotMatch(migration,forbidden);
assert.match(nextConfig,/CONNECT_CONTENT_SECURITY_POLICY/);assert.match(nextConfig,/https:\/\/connect-js\.stripe\.com/);assert.match(nextConfig,/source:"\/payments\/connect"/);assert.match(nextConfig,/Cross-Origin-Opener-Policy"\?\s*,?\s*value:"unsafe-none"|value:\s*"unsafe-none"/);
console.log('Customer Payment Autopilot / Stripe Connect contract: PASS');
