import { getMarketBillingRuntime,getMarketBillingSku,resolveMarketStripePrice } from '../../config/market-billing-catalog.js';

export class MarketBillingError extends Error{constructor(message,code='MARKET_BILLING_ERROR',status=400){super(message);this.name='MarketBillingError';this.code=code;this.status=status;}}
const clean=(value,max=200)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const ID=/^[A-Za-z0-9._:-]{1,180}$/;

function checkoutOrigin(){const raw=clean(process.env.MARKET_CHECKOUT_ORIGIN||'https://laneriq-ai.vercel.app',500);let url;try{url=new URL(raw);}catch{throw new MarketBillingError('Checkout origin is invalid.','MARKET_CHECKOUT_ORIGIN_INVALID',500);}if(url.protocol!=='https:')throw new MarketBillingError('Checkout origin must use HTTPS.','MARKET_CHECKOUT_ORIGIN_INVALID',500);return url.origin;}
function requireSecret(runtime){const secret=String(process.env.STRIPE_SECRET_KEY||'');if(!runtime.configured||!runtime.checkoutAllowed)throw new MarketBillingError('Market checkout is not enabled for this environment.','MARKET_CHECKOUT_DISABLED',503);return secret;}

export async function createMarketCheckoutSession({userId,sku,requestId,appId=null}={}){
  const user=clean(userId,180),request=clean(requestId,160),app=appId?clean(appId,180):null;
  if(!ID.test(user)||!ID.test(request)||(app&&!ID.test(app)))throw new MarketBillingError('Checkout identity is invalid.','MARKET_CHECKOUT_ID_INVALID',400);
  const item=getMarketBillingSku(sku);if(!item)throw new MarketBillingError('Unknown market SKU.','MARKET_CHECKOUT_SKU_INVALID',400);
  const runtime=getMarketBillingRuntime();if(item.buyout&&!runtime.buyoutCheckoutEnabled)throw new MarketBillingError('Buyout checkout remains disabled until the secure Production issuance path is closed.','MARKET_BUYOUT_CHECKOUT_DISABLED',409);
  if(item.buyout&&!app)throw new MarketBillingError('Buyout checkout requires an owned project.','MARKET_BUYOUT_APP_REQUIRED',400);
  const price=resolveMarketStripePrice(item.sku);if(!price)throw new MarketBillingError('A trusted Stripe price is not configured.','MARKET_CHECKOUT_PRICE_UNAVAILABLE',503);
  const secret=requireSecret(runtime),origin=checkoutOrigin();
  const body=new URLSearchParams();
  body.set('mode','payment');body.set('line_items[0][price]',price);body.set('line_items[0][quantity]','1');
  body.set('success_url',`${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`);body.set('cancel_url',`${origin}/account?checkout=cancelled`);
  body.set('client_reference_id',user);body.set('metadata[user_id]',user);body.set('metadata[sku]',item.sku);body.set('metadata[request_id]',request);if(app)body.set('metadata[app_id]',app);
  body.set('payment_intent_data[metadata][user_id]',user);body.set('payment_intent_data[metadata][sku]',item.sku);body.set('payment_intent_data[metadata][request_id]',request);if(app)body.set('payment_intent_data[metadata][app_id]',app);
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`laneriq-market:${user}:${request}`},body:body.toString(),cache:'no-store',redirect:'error'});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data?.id||!data?.url)throw new MarketBillingError('Stripe Checkout could not be created.',clean(data?.error?.code,100)||'MARKET_STRIPE_CHECKOUT_FAILED',502);
  if(Boolean(data.livemode)!==runtime.live)throw new MarketBillingError('Stripe Checkout mode did not match the server billing mode.','MARKET_STRIPE_MODE_MISMATCH',502);
  return Object.freeze({sessionId:clean(data.id,180),url:String(data.url),livemode:Boolean(data.livemode),sku:item.sku,amountMinor:item.amountMinor,currency:item.currency,clientGrantedEntitlement:false});
}
