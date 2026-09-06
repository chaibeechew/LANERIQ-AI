import { STRIPE_CONNECT_LIVE_RELEASE_POLICY } from '../../config/stripe-connect-live-release-policy.js';

const SHA_RE = /^[a-f0-9]{40}$/i;
const DIGEST_RE = /^[a-f0-9]{64}$/i;
const OPAQUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,180}$/;
const ACCOUNT_RE = /^acct_[A-Za-z0-9]{8,}$/;
const PAYMENT_INTENT_RE = /^pi_[A-Za-z0-9]{8,}$/;

function text(value, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function opaqueId(value) {
  const out = text(value, 180);
  return OPAQUE_ID_RE.test(out) ? out : '';
}

function timestampIsFresh(value, nowMs, maxAgeHours) {
  const observedMs = Date.parse(String(value || ''));
  if (!Number.isFinite(observedMs)) return false;
  const futureToleranceMs = 5 * 60 * 1000;
  if (observedMs > nowMs + futureToleranceMs) return false;
  return nowMs - observedMs <= maxAgeHours * 60 * 60 * 1000;
}

function observedEvidence(entry, nowMs, { liveRequired = false } = {}) {
  const source = text(entry?.source, 80);
  const evidenceId = opaqueId(entry?.evidenceId);
  const fresh = timestampIsFresh(
    entry?.observedAt,
    nowMs,
    STRIPE_CONNECT_LIVE_RELEASE_POLICY.maxEvidenceAgeHours,
  );
  const observed = entry?.observed === true;
  const livemodeOk = !liveRequired || entry?.livemode === true;
  return {
    ok: observed && source === 'stripe_observed' && Boolean(evidenceId) && fresh && livemodeOk,
    observed,
    source,
    evidenceId,
    fresh,
    livemodeOk,
  };
}

export function evaluateStripeConnectLiveReadiness(input = {}, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  const environment = input.environment === 'live' ? 'live' : 'sandbox';
  const mainCommitSha = text(input.mainCommitSha, 40);
  const productionCommitSha = text(input.productionCommitSha, 40);
  const productionEnvironment = text(input.productionEnvironment, 32);
  const connected = input.connectedAccount || {};
  const evidence = input.evidence || {};
  const authority = input.runtimeAttestation || {};

  const exactSha = SHA_RE.test(mainCommitSha)
    && SHA_RE.test(productionCommitSha)
    && mainCommitSha.toLowerCase() === productionCommitSha.toLowerCase()
    && productionEnvironment === 'production';

  const connectedAccountReady = ACCOUNT_RE.test(text(connected.id, 180))
    && connected.chargesEnabled === true
    && connected.payoutsEnabled === true
    && connected.cardPaymentsCapability === 'active'
    && Number(connected.requirementsCurrentlyDue || 0) === 0;

  const merchantOnboarding = observedEvidence(evidence.merchantOnboarding, nowMs, { liveRequired: true });
  const webhook = observedEvidence(evidence.webhook, nowMs, { liveRequired: true });
  const livePayment = observedEvidence(evidence.livePayment, nowMs, { liveRequired: true });
  const livePayout = observedEvidence(evidence.livePayout, nowMs, { liveRequired: true });
  const liveRefund = observedEvidence(evidence.liveRefund, nowMs, { liveRequired: true });

  const paymentIntentId = text(evidence.livePayment?.paymentIntentId, 180);
  const livePaymentShapeOk = PAYMENT_INTENT_RE.test(paymentIntentId)
    && Number.isInteger(evidence.livePayment?.amount)
    && Number(evidence.livePayment.amount) > 0
    && /^[a-z]{3}$/.test(text(evidence.livePayment?.currency, 3))
    && text(evidence.livePayment?.status, 40) === 'succeeded';

  const runtimeAttestationOk = input.syntheticFixture !== true
    && authority.verified === true
    && authority.source === 'stripe_runtime_observer'
    && Boolean(opaqueId(authority.attestationId))
    && DIGEST_RE.test(text(authority.attestationDigest, 64))
    && timestampIsFresh(
      authority.observedAt,
      nowMs,
      STRIPE_CONNECT_LIVE_RELEASE_POLICY.maxEvidenceAgeHours,
    );

  const accountLivemode = input.stripeAccountLivemode === true;
  const liveEnvironment = environment === 'live' && accountLivemode;
  const paymentAcceptanceEvidenceComplete = exactSha
    && connectedAccountReady
    && merchantOnboarding.ok
    && webhook.ok
    && livePayment.ok
    && livePaymentShapeOk;

  const releaseGateSatisfied = liveEnvironment
    && runtimeAttestationOk
    && paymentAcceptanceEvidenceComplete;

  const fullCashflowGateSatisfied = releaseGateSatisfied && livePayout.ok && liveRefund.ok;

  const blockers = [];
  if (!liveEnvironment) blockers.push('live_environment_not_verified');
  if (!exactSha) blockers.push('production_exact_sha_missing');
  if (!connectedAccountReady) blockers.push('connected_account_not_ready');
  if (!merchantOnboarding.ok) blockers.push('merchant_onboarding_evidence_missing');
  if (!webhook.ok) blockers.push('webhook_evidence_missing');
  if (!livePayment.ok || !livePaymentShapeOk) blockers.push('live_payment_evidence_missing');
  if (!runtimeAttestationOk) blockers.push('runtime_attestation_missing');

  return {
    policyVersion: STRIPE_CONNECT_LIVE_RELEASE_POLICY.version,
    environment,
    chargeModel: STRIPE_CONNECT_LIVE_RELEASE_POLICY.chargeModel,
    merchantOfRecord: STRIPE_CONNECT_LIVE_RELEASE_POLICY.merchantOfRecord,
    applicationFeeAmount: 0,
    platformFeePercent: 0,
    sensitivePaymentDataStoredByLaneriq: false,
    exactSha,
    connectedAccountReady,
    accountLivemode,
    merchantOnboardingObserved: merchantOnboarding.ok,
    webhookObserved: webhook.ok,
    livePaymentObserved: livePayment.ok && livePaymentShapeOk,
    livePayoutObserved: livePayout.ok,
    liveRefundObserved: liveRefund.ok,
    runtimeAttestationAccepted: runtimeAttestationOk,
    paymentAcceptanceEvidenceComplete,
    releaseGateSatisfied,
    fullCashflowGateSatisfied,
    blockers,
    truth: {
      codeReady: true,
      sandboxVerified: environment === 'sandbox' && input.syntheticFixture !== true,
      liveProviderVerified: false,
      productionLiveVerified: false,
      realPaymentQualityVerified: false,
      externalEvidenceStillRequired: !releaseGateSatisfied,
    },
  };
}
