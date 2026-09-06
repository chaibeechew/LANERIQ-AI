import { NextResponse } from 'next/server.js';
import { createClient } from '../../../../../lib/supabase/server.js';
import { getCustomerPaymentConnectRuntime } from '../../../../../config/customer-payment-connect-policy.js';
import { createStripeConnectAccountSession } from '../../../../../lib/payments/stripe-connect.js';
import { getCustomerConnectAccount } from '../../../../../lib/payments/customer-connect-store.js';

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function trustedOrigin(request) {
  const origin = String(request.headers.get('origin') || '');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    if (!trustedOrigin(request)) {
      return json({ ok: false, error: 'Trusted same-origin request required.' }, 403);
    }

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id) {
      return json({ ok: false, error: 'Authentication required.' }, 401);
    }
    if (!user.email || (!user.email_confirmed_at && !user.confirmed_at)) {
      return json({ ok: false, error: 'Account verification required.' }, 403);
    }

    const runtime = getCustomerPaymentConnectRuntime();
    if (!runtime.configured) {
      return json({ ok: false, error: 'Stripe Connect is not configured.' }, 503);
    }

    const row = await getCustomerConnectAccount(user.id);
    if (!row?.stripe_account_id) {
      return json({ ok: false, error: 'Connected payment account has not been created.' }, 409);
    }
    if (Boolean(row.livemode) !== Boolean(runtime.live)) {
      return json({ ok: false, error: 'Stripe Connect environment mismatch.' }, 409);
    }

    const session = await createStripeConnectAccountSession(row.stripe_account_id);
    if (!session?.client_secret) {
      return json({ ok: false, error: 'Stripe account session is incomplete.' }, 503);
    }

    return json({
      ok: true,
      clientSecret: session.client_secret,
      publishableKey: runtime.publishableKey,
      accountId: row.stripe_account_id,
      components: [
        'account_onboarding',
        'notification_banner',
        'account_management',
        'balances',
        'payouts',
      ],
    });
  } catch (error) {
    return json(
      { ok: false, error: String(error?.message || 'Stripe account session failed.').slice(0, 220) },
      Number(error?.status) || 503,
    );
  }
}
