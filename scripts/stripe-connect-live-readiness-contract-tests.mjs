import assert from 'node:assert/strict';
import fs from 'node:fs';

import { STRIPE_CONNECT_LIVE_RELEASE_POLICY } from '../config/stripe-connect-live-release-policy.js';
import { evaluateStripeConnectLiveReadiness } from '../lib/payments/stripe-connect-live-readiness.js';
import { buildMerchantPaymentExecutionPlan } from '../lib/payments/merchant-payment-execution-policy.js';
import { buildMerchantPaymentEvidenceReceipt } from '../lib/payments/merchant-payment-evidence.js';

const NOW = Date.parse('2026-09-06T09:00:00.000Z');
const observedAt = '2026-09-06T08:55:00.000Z';
const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);

assert.equal(STRIPE_CONNECT_LIVE_RELEASE_POLICY.chargeModel, 'direct_charge');
assert.equal(STRIPE_CONNECT_LIVE_RELEASE_POLICY.applicationFeeAmount, 0);
assert.equal(STRIPE_CONNECT_LIVE_RELEASE_POLICY.platformFeePercent, 0);
assert.equal(STRIPE_CONNECT_LIVE_RELEASE_POLICY.sensitivePaymentDataStoredByLaneriq, false);
assert.equal(STRIPE_CONNECT_LIVE_RELEASE_POLICY.sandboxCanSatisfyLiveGate, false);

const sandbox = evaluateStripeConnectLiveReadiness({
  environment: 'sandbox',
  syntheticFixture: false,
  stripeAccountLivemode: false,
}, { nowMs: NOW });
assert.equal(sandbox.releaseGateSatisfied, false);
assert.equal(sandbox.truth.liveProviderVerified, false);
assert.ok(sandbox.blockers.includes('live_environment_not_verified'));

const syntheticLive = evaluateStripeConnectLiveReadiness({
  environment: 'live',
  syntheticFixture: true,
  mainCommitSha: sha,
  productionCommitSha: sha,
  productionEnvironment: 'production',
  stripeAccountLivemode: true,
  connectedAccount: {
    id: 'acct_1234567890',
    chargesEnabled: true,
    payoutsEnabled: true,
    cardPaymentsCapability: 'active',
    requirementsCurrentlyDue: 0,
  },
  runtimeAttestation: {
    verified: true,
    source: 'stripe_runtime_observer',
    attestationId: 'attestation:12345678',
    attestationDigest: digest,
    observedAt,
  },
  evidence: {
    merchantOnboarding: { observed: true, source: 'stripe_observed', evidenceId: 'evidence:onboarding:1', observedAt, livemode: true },
    webhook: { observed: true, source: 'stripe_observed', evidenceId: 'evidence:webhook:123', observedAt, livemode: true },
    livePayment: {
      observed: true,
      source: 'stripe_observed',
      evidenceId: 'evidence:payment:123',
      observedAt,
      livemode: true,
      paymentIntentId: 'pi_1234567890',
      amount: 100,
      currency: 'myr',
      status: 'succeeded',
    },
  },
}, { nowMs: NOW });
assert.equal(syntheticLive.paymentAcceptanceEvidenceComplete, true);
assert.equal(syntheticLive.runtimeAttestationAccepted, false, 'Synthetic fixtures must never satisfy runtime attestation');
assert.equal(syntheticLive.releaseGateSatisfied, false, 'Synthetic fixtures must never release LIVE');
assert.equal(syntheticLive.truth.liveProviderVerified, false);

const stale = evaluateStripeConnectLiveReadiness({
  environment: 'live',
  syntheticFixture: false,
  mainCommitSha: sha,
  productionCommitSha: sha,
  productionEnvironment: 'production',
  stripeAccountLivemode: true,
  connectedAccount: {
    id: 'acct_1234567890', chargesEnabled: true, payoutsEnabled: true,
    cardPaymentsCapability: 'active', requirementsCurrentlyDue: 0,
  },
  runtimeAttestation: {
    verified: true, source: 'stripe_runtime_observer', attestationId: 'attestation:12345678',
    attestationDigest: digest, observedAt: '2026-08-01T00:00:00.000Z',
  },
}, { nowMs: NOW });
assert.equal(stale.releaseGateSatisfied, false);
assert.ok(stale.blockers.includes('runtime_attestation_missing'));

const plan = buildMerchantPaymentExecutionPlan({
  connectedAccountId: 'acct_1234567890',
  amount: 2500,
  currency: 'MYR',
  appId: 'app:12345678',
  orderId: 'order:12345678',
  idempotencyKey: 'idem:12345678',
  liveMode: false,
  metadata: { sku: 'pro_monthly', locale: 'en-MY' },
});
assert.equal(plan.chargeModel, 'direct_charge');
assert.equal(plan.applicationFeeAmount, 0);
assert.equal(plan.platformFeePercent, 0);
assert.equal(plan.transferData, null);
assert.equal(plan.rawPaymentMethodDataAccepted, false);
assert.equal(plan.providerInvocationPerformed, false);
assert.equal(plan.currency, 'myr');

assert.throws(() => buildMerchantPaymentExecutionPlan({
  connectedAccountId: 'acct_1234567890', amount: 100, currency: 'myr',
  appId: 'app:12345678', orderId: 'order:12345678', idempotencyKey: 'idem:12345678',
  liveMode: false, cardNumber: '4242424242424242',
}), /Sensitive payment field/);

assert.throws(() => buildMerchantPaymentExecutionPlan({
  connectedAccountId: 'acct_1234567890', amount: 100, currency: 'myr',
  appId: 'app:12345678', orderId: 'order:12345678', idempotencyKey: 'idem:12345678',
  liveMode: false, metadata: { client_secret: 'do-not-store' },
}), /Sensitive/);

const receiptA = buildMerchantPaymentEvidenceReceipt({
  paymentIntentId: 'pi_1234567890',
  connectedAccountId: 'acct_1234567890',
  requestId: 'req_12345678',
  status: 'succeeded', amount: 2500, currency: 'MYR', livemode: false, observedAt,
});
const receiptB = buildMerchantPaymentEvidenceReceipt({
  paymentIntentId: 'pi_1234567890',
  connectedAccountId: 'acct_1234567890',
  requestId: 'req_12345678',
  status: 'succeeded', amount: 2500, currency: 'MYR', livemode: false, observedAt,
});
assert.equal(receiptA.receiptDigest, receiptB.receiptDigest, 'Evidence digest must be deterministic');
assert.match(receiptA.receiptDigest, /^[a-f0-9]{64}$/);
assert.equal(receiptA.liveObservation, false);
assert.equal(receiptA.liveProviderVerified, false);
assert.equal(receiptA.sensitivePaymentDataStored, false);

for (const file of [
  'config/stripe-connect-live-release-policy.js',
  'lib/payments/stripe-connect-live-readiness.js',
  'lib/payments/merchant-payment-execution-policy.js',
  'lib/payments/merchant-payment-evidence.js',
]) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /sk_live_[A-Za-z0-9]+/);
}

console.log('Stripe Connect LIVE Readiness & Merchant Payment Gate contract: PASS');
