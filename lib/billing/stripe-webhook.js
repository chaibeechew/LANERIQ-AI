import crypto from 'node:crypto';
import { getMarketBillingSku } from '../../config/market-billing-catalog.js';

export class StripeWebhookError extends Error{constructor(message,code='STRIPE_WEBHOOK_INVALID'){super(message);this.name='StripeWebhookError';this.code=code;}}
const clean=(value,max=240)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const SHA=/^[a-f0-9]{64}$/;
function safeEqual(a,b){try{const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);}catch{return false;}}

export function verifyStripeWebhookSignature(rawBody,signatureHeader,{secret=process.env.STRIPE_WEBHOOK_SECRET,toleranceSeconds=300,nowSeconds=Math.floor(Date.now()/1000)}={}){
  const raw=String(rawBody??''),header=String(signatureHeader||''),key=String(secret||'');if(!raw||!header||!key.startsWith('whsec_'))throw new StripeWebhookError('Stripe webhook signature is unavailable.','STRIPE_WEBHOOK_SIGNATURE_REQUIRED');
  let timestamp=null;const signatures=[];for(const part of header.split(',')){const [k,...rest]=part.trim().split('=');const v=rest.join('=');if(k==='t')timestamp=Number(v);if(k==='v1'&&/^[a-f0-9]{64}$/i.test(v))signatures.push(v.toLowerCase());}
  if(!Number.isFinite(timestamp)||Math.abs(nowSeconds-timestamp)>Math.max(60,Number(toleranceSeconds)||300))throw new StripeWebhookError('Stripe webhook timestamp is outside tolerance.','STRIPE_WEBHOOK_TIMESTAMP_INVALID');
  const expected=crypto.createHmac('sha256',key).update(`${timestamp}.${raw}`,'utf8').digest('hex');if(!signatures.some(sig=>safeEqual(expected,sig)))throw new StripeWebhookError('Stripe webhook signature did not verify.','STRIPE_WEBHOOK_SIGNATURE_INVALID');
  return Object.freeze({verified:true,timestamp,digest:crypto.createHash('sha256').update(raw,'utf8').digest('hex')});
}

export function normalizeMarketStripeEvent(event,signatureEvidence){
  const source=event&&typeof event==='object'?event:{};const object=source?.data?.object&&typeof source.data.object==='object'?source.data.object:{};const eventId=clean(source.id,180);if(!/^evt_[A-Za-z0-9]+$/.test(eventId))throw new StripeWebhookError('Stripe event id is invalid.','STRIPE_EVENT_ID_INVALID');if(signatureEvidence?.verified!==true||!SHA.test(String(signatureEvidence?.digest||'')))throw new StripeWebhookError('Verified payload evidence is required.','STRIPE_EVENT_EVIDENCE_REQUIRED');
  const type=clean(source.type,100),metadata=object.metadata&&typeof object.metadata==='object'?object.metadata:{};const sku=clean(metadata.sku,80).toLowerCase(),item=getMarketBillingSku(sku);const userId=clean(metadata.user_id||object.client_reference_id,180),appId=clean(metadata.app_id,180)||null,requestId=clean(metadata.request_id,160)||null;
  const paymentIntent=typeof object.payment_intent==='string'?clean(object.payment_intent,180):typeof object.id==='string'&&String(object.id).startsWith('pi_')?clean(object.id,180):null;
  const checkoutSession=String(object.id||'').startsWith('cs_')?clean(object.id,180):null;
  const amountMinor=Number(object.amount_total??object.amount_received??object.amount??0);const currency=clean(object.currency,10).toLowerCase();
  const paid=(type==='checkout.session.completed'&&object.payment_status==='paid')||type==='checkout.session.async_payment_succeeded';
  const refunded=type==='charge.refunded'||type==='refund.updated'&&object.status==='succeeded';
  return Object.freeze({eventId,type,livemode:source.livemode===true,created:Number(source.created)||null,payloadHash:signatureEvidence.digest,paid,refunded,userId,sku,item,appId,requestId,paymentIntent,checkoutSession,amountMinor:Number.isFinite(amountMinor)?Math.max(0,Math.floor(amountMinor)):0,currency,rawEntitlementGranted:false});
}
