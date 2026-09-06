import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin.js';
import { getMarketBillingRuntime } from '../../../../config/market-billing-catalog.js';
import { normalizeMarketStripeEvent,verifyStripeWebhookSignature,StripeWebhookError } from '../../../../lib/billing/stripe-webhook.js';

const MAX_BYTES=256*1024,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}

export async function POST(request){
  try{
    const length=Number(request.headers.get('content-length')||0);if(length>MAX_BYTES)return reply({error:'Webhook payload too large.'},413);const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)return reply({error:'Webhook payload too large.'},413);
    const signature=verifyStripeWebhookSignature(raw,request.headers.get('stripe-signature'));const event=JSON.parse(raw);const normalized=normalizeMarketStripeEvent(event,signature);const runtime=getMarketBillingRuntime();if(normalized.livemode!==runtime.live)return reply({error:'Stripe event mode mismatch.'},400);
    const admin=createAdminClient();
    if(normalized.paid){
      if(!normalized.item||!UUID.test(normalized.userId)||!normalized.paymentIntent||!normalized.checkoutSession||normalized.amountMinor!==normalized.item.amountMinor||normalized.currency!==normalized.item.currency)return reply({error:'Paid Checkout event did not match the trusted LANERIQ catalog.'},400);
      const{data,error}=await admin.rpc('server_fulfill_market_payment',{p_provider_event_id:normalized.eventId,p_checkout_session_id:normalized.checkoutSession,p_payment_intent_id:normalized.paymentIntent,p_user_id:normalized.userId,p_sku:normalized.sku,p_app_id:normalized.appId&&UUID.test(normalized.appId)?normalized.appId:null,p_amount_minor:normalized.amountMinor,p_currency:normalized.currency,p_livemode:normalized.livemode,p_payload_hash:normalized.payloadHash});if(error)throw error;return reply({received:true,processed:true,result:data||null});
    }
    if(normalized.refunded){if(!normalized.paymentIntent)return reply({received:true,processed:false,reason:'refund-payment-reference-missing'});const{data,error}=await admin.rpc('server_revoke_market_payment',{p_provider_event_id:normalized.eventId,p_payment_intent_id:normalized.paymentIntent,p_payload_hash:normalized.payloadHash});if(error)throw error;return reply({received:true,processed:true,result:data||null});}
    return reply({received:true,processed:false,reason:'event-not-used-for-entitlement'});
  }catch(error){if(error instanceof StripeWebhookError)return reply({error:error.message,code:error.code},400);console.error('MARKET_STRIPE_WEBHOOK_ERROR',error?.code||error?.name||'unknown');return reply({error:'Webhook processing failed.'},500);}
}
