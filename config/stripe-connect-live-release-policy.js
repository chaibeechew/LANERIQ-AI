export const STRIPE_CONNECT_LIVE_RELEASE_POLICY = Object.freeze({
  version: 1,
  chargeModel: 'direct_charge',
  merchantOfRecord: 'connected_account',
  applicationFeeAmount: 0,
  platformFeePercent: 0,
  sensitivePaymentDataStoredByLaneriq: false,
  rawPanAllowed: false,
  rawCvcAllowed: false,
  rawBankCredentialAllowed: false,
  paymentElementRequired: true,
  sandboxCanSatisfyLiveGate: false,
  liveClaimRequiresObservedStripeEvidence: true,
  liveClaimRequiresRuntimeAttestation: true,
  requiredCapabilities: Object.freeze(['card_payments']),
  requiredLiveEvidence: Object.freeze([
    'production_exact_sha',
    'connected_account_ready',
    'merchant_onboarding_observed',
    'webhook_observed',
    'live_payment_observed',
  ]),
  fullCashflowEvidence: Object.freeze([
    'live_payout_observed',
    'live_refund_observed',
  ]),
  maxEvidenceAgeHours: 168,
});

export function getStripeConnectLiveReleasePolicy() {
  return STRIPE_CONNECT_LIVE_RELEASE_POLICY;
}
