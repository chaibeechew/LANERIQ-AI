import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server.js';
import { createMarketCheckoutSession,MarketBillingError } from '../../../../lib/billing/stripe-checkout.js';
import { getMarketBillingRuntime,getMarketBillingSku } from '../../../../config/market-billing-catalog.js';

const MAX_BYTES=8*1024,ID=/^[A-Za-z0-9._:-]{1,180}$/;
function reply(body,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}

export async function POST(request){
  try{
    const length=Number(request.headers.get('content-length')||0);if(length>MAX_BYTES)return reply({error:'Checkout request is too large.'},413);
    const client=await createClient();const{data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Authentication required.'},401);if(!user.confirmed_at&&!user.email_confirmed_at&&!user.phone_confirmed_at)return reply({error:'Account verification required.'},403);
    const body=await request.json().catch(()=>null);if(!body||Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_BYTES)return reply({error:'Invalid checkout request.'},400);
    const sku=String(body.sku||'').trim().toLowerCase(),item=getMarketBillingSku(sku),requestId=String(body.requestId||'').trim(),appId=body.appId?String(body.appId).trim():null;if(!item||!ID.test(requestId)||(appId&&!ID.test(appId)))return reply({error:'Checkout request is invalid.'},400);
    if(item.buyout){const runtime=getMarketBillingRuntime();if(!runtime.buyoutCheckoutEnabled)return reply({error:'Buyout checkout remains disabled until the secure Production issuance path is closed.'},409);if(!appId)return reply({error:'Buyout requires an eligible owned project.'},400);const{data:app,error:appError}=await client.from('apps').select('id,owner_id,publish_status').eq('id',appId).eq('owner_id',user.id).maybeSingle();if(appError||!app)return reply({error:'Project not found.'},404);if(String(app.publish_status||'').toLowerCase()==='published')return reply({error:'Buyout must be selected before publish.'},409);}
    const session=await createMarketCheckoutSession({userId:user.id,sku,requestId,appId});return reply({ok:true,checkout:{sessionId:session.sessionId,url:session.url,livemode:session.livemode,sku:session.sku},entitlementGranted:false,note:'Access is granted only after a verified server-side Stripe payment event.'});
  }catch(error){if(error instanceof MarketBillingError)return reply({error:error.message,code:error.code},error.status||400);console.error('MARKET_CHECKOUT_ERROR',error?.code||error?.name||'unknown');return reply({error:'Checkout is temporarily unavailable.'},503);}
}
