const ACCOUNT_RE = /^acct_[A-Za-z0-9]{8,}$/;
const OPAQUE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,180}$/;
const FORBIDDEN_KEYS = /(card.?number|\bpan\b|cvc|cvv|routing.?number|bank.?account|iban|secret.?key|client.?secret|private.?key)/i;

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function walkForForbiddenKeys(value, path = 'input') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkForForbiddenKeys(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Sensitive payment field is not allowed: ${path}.${key}`);
    walkForForbiddenKeys(child, `${path}.${key}`);
  }
}

function cleanMetadata(value) {
  if (!value) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('metadata must be an object');
  const entries = Object.entries(value).slice(0, 20);
  const out = {};
  for (const [rawKey, rawValue] of entries) {
    const key = text(rawKey, 40);
    if (!/^[A-Za-z0-9_.:-]{1,40}$/.test(key)) throw new Error('metadata key is invalid');
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Sensitive metadata key is not allowed: ${key}`);
    const valueText = text(rawValue, 160);
    if (!valueText) continue;
    out[key] = valueText;
  }
  return out;
}

export function buildMerchantPaymentExecutionPlan(input = {}) {
  walkForForbiddenKeys(input);

  const connectedAccountId = text(input.connectedAccountId, 180);
  if (!ACCOUNT_RE.test(connectedAccountId)) throw new Error('A valid connected Stripe account id is required');

  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
    throw new Error('amount must be a bounded positive integer in minor currency units');
  }

  const currency = text(input.currency, 3).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error('currency must be a 3-letter ISO-style code');

  const appId = text(input.appId, 180);
  const orderId = text(input.orderId, 180);
  const idempotencyKey = text(input.idempotencyKey, 180);
  if (!OPAQUE_RE.test(appId)) throw new Error('appId must be an opaque id');
  if (!OPAQUE_RE.test(orderId)) throw new Error('orderId must be an opaque id');
  if (!OPAQUE_RE.test(idempotencyKey)) throw new Error('idempotencyKey must be an opaque id');
  if (typeof input.liveMode !== 'boolean') throw new Error('liveMode must be explicit');

  return {
    version: 1,
    provider: 'stripe',
    operation: 'payment_intent.create',
    chargeModel: 'direct_charge',
    merchantOfRecord: 'connected_account',
    connectedAccountId,
    amount,
    currency,
    appId,
    orderId,
    idempotencyKey,
    liveMode: input.liveMode,
    paymentMethodTypes: ['card'],
    metadata: cleanMetadata(input.metadata),
    applicationFeeAmount: 0,
    platformFeePercent: 0,
    transferData: null,
    rawPaymentMethodDataAccepted: false,
    paymentElementRequired: true,
    providerInvocationPerformed: false,
    livePaymentVerified: false,
  };
}
