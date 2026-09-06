import { NextResponse } from 'next/server.js';
import { getCustomerPaymentConnectRuntime } from '../../../../../config/customer-payment-connect-policy.js';
import {
  verifyStripeConnectWebhookSignature,
  retrieveStripeConnectedMerchant,
  normalizeStripeMerchantStatus,
} from '../../../../../lib/payments/stripe-connect.js';
import {
  getCustomerConnectAccountByStripeId,
  saveCustomerConnectAccount,
  recordConnectEvent,
} from '../../../../../lib/payments/customer-connect-store.js';

const MAX_BYTES = 262144;

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return json({ ok: false, error: 'Webhook body is too large.' }, 413);

    const runtime = getCustomerPaymentConnectRuntime();
    if (!runtime.webhookConfigured) {
      return json({ ok: false, error: 'Stripe Connect webhook is not configured.' }, 503);
    }

    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BYTES) {
      return json({ ok: false, error: 'Webhook body is too large.' }, 413);
    }

    verifyStripeConnectWebhookSignature(raw, request.headers.get('stripe-signature'), {
      secret: runtime.webhookSecret,
    });

    let event = {};
    try {
      event = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: 'Invalid webhook JSON.' }, 400);
    }

    const type = String(event?.type || '');
    if (!type.startsWith('v2.core.account')) return json({ ok: true, ignored: true });

    const accountId = String(event?.related_object?.id || '');
    if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) {
      return json({ ok: true, ignored: true, reason: 'no_account_reference' });
    }

    const mapping = await getCustomerConnectAccountByStripeId(accountId);
    if (!mapping?.user_id) {
      return json({ ok: true, ignored: true, reason: 'unmapped_account' });
    }

    const remote = await retrieveStripeConnectedMerchant(accountId);
    const status = normalizeStripeMerchantStatus(remote);
    if (Boolean(event?.livemode) !== Boolean(status.livemode)) {
      return json({ ok: false, error: 'Stripe Connect event environment mismatch.' }, 409);
    }

    await saveCustomerConnectAccount({ userId: mapping.user_id, status });
    await recordConnectEvent({
      eventId: event.id,
      eventType: type,
      accountId,
      livemode: event.livemode === true,
    });

    return json({
      ok: true,
      processed: true,
      state: status.onboardingState,
      readyForPayments: status.readyForPayments,
    });
  } catch (error) {
    return json(
      { ok: false, error: String(error?.message || 'Stripe Connect webhook failed.').slice(0, 220) },
      Number(error?.status) || 400,
    );
  }
}
