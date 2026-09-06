import crypto from 'node:crypto';

const ACCOUNT_RE = /^acct_[A-Za-z0-9]{8,}$/;
const PAYMENT_INTENT_RE = /^pi_[A-Za-z0-9]{8,}$/;
const REQUEST_RE = /^req_[A-Za-z0-9]{6,}$/;

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildMerchantPaymentEvidenceReceipt(input = {}) {
  const paymentIntentId = text(input.paymentIntentId, 180);
  const connectedAccountId = text(input.connectedAccountId, 180);
  const requestId = text(input.requestId, 180);
  const status = text(input.status, 40);
  const currency = text(input.currency, 3).toLowerCase();
  const amount = Number(input.amount);
  const observedAt = text(input.observedAt, 40);
  const observedMs = Date.parse(observedAt);

  if (!PAYMENT_INTENT_RE.test(paymentIntentId)) throw new Error('paymentIntentId is invalid');
  if (!ACCOUNT_RE.test(connectedAccountId)) throw new Error('connectedAccountId is invalid');
  if (requestId && !REQUEST_RE.test(requestId)) throw new Error('requestId is invalid');
  if (!['succeeded', 'requires_action', 'processing', 'canceled'].includes(status)) throw new Error('status is invalid');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) throw new Error('amount is invalid');
  if (!/^[a-z]{3}$/.test(currency)) throw new Error('currency is invalid');
  if (!Number.isFinite(observedMs)) throw new Error('observedAt is invalid');
  if (typeof input.livemode !== 'boolean') throw new Error('livemode must be explicit');

  const payload = {
    version: 1,
    source: 'stripe_observed',
    paymentIntentId,
    connectedAccountId,
    requestId: requestId || null,
    status,
    amount,
    currency,
    livemode: input.livemode,
    observedAt: new Date(observedMs).toISOString(),
    sensitivePaymentDataStored: false,
  };
  const receiptDigest = crypto.createHash('sha256').update(stableJson(payload)).digest('hex');

  return {
    ...payload,
    receiptDigest,
    paymentSucceeded: status === 'succeeded',
    liveObservation: input.livemode === true && status === 'succeeded',
    liveProviderVerified: false,
    runtimeAttestationStillRequired: true,
  };
}
