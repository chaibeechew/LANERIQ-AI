import crypto from 'node:crypto';
import {assertStripeConnectedAccountId,getCustomerPaymentConnectRuntime} from '../../config/customer-payment-connect-policy.js';

function safeError(payload,status){const message=String(payload?.error?.message||payload?.error?.code||`Stripe request failed (${status}).`).slice(0,220);const error=new Error(message);error.status=status;throw error;}
async function stripeRequest(path,{method='GET',body=null,form=false,idempotencyKey=null}={}){
  const runtime=getCustomerPaymentConnectRuntime();
  if(!runtime.configured)throw Object.assign(new Error('Stripe Connect is not configured.'),{status:503});
  const headers={Authorization:`Bearer ${runtime.secret}`,'Stripe-Version':runtime.apiVersion};
  if(body!==null)headers['Content-Type']=form?'application/x-www-form-urlencoded':'application/json';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const response=await fetch(`https://api.stripe.com${path}`,{method,headers,body:body===null?undefined:(form?body:JSON.stringify(body)),cache:'no-store',signal:AbortSignal.timeout(20000)});
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok)safeError(payload,response.status);
  return payload;
}
function formBody(entries){const params=new URLSearchParams();for(const [key,value] of entries){if(value!==null&&value!==undefined)params.append(key,String(value));}return params.toString();}
export async function createStripeConnectedMerchant({userId,email,displayName,country,locale}){
  const body={contact_email:String(email||'').trim(),display_name:String(displayName||'LANERIQ Creator').trim().slice(0,120),dashboard:'full',configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'},locales:[locale||'en-US']},include:['configuration.merchant','identity','requirements','defaults'],metadata:{laneriq_user_id:String(userId),integration:'customer_payment_autopilot'}};
  if(country)body.identity={country};
  return stripeRequest('/v2/core/accounts',{method:'POST',body,idempotencyKey:`laneriq-connect-account:${userId}`});
}
export async function retrieveStripeConnectedMerchant(accountId){
  const id=assertStripeConnectedAccountId(accountId);const query=new URLSearchParams();for(const value of ['configuration.merchant','identity','requirements','future_requirements','defaults'])query.append('include',value);return stripeRequest(`/v2/core/accounts/${encodeURIComponent(id)}?${query.toString()}`);
}
export async function createStripeConnectAccountSession(accountId){
  const id=assertStripeConnectedAccountId(accountId);const body=formBody([
    ['account',id],
    ['components[account_onboarding][enabled]','true'],
    ['components[notification_banner][enabled]','true'],
    ['components[account_management][enabled]','true'],
    ['components[balances][enabled]','true'],
    ['components[payouts][enabled]','true'],
  ]);return stripeRequest('/v1/account_sessions',{method:'POST',body,form:true});
}
export function normalizeStripeMerchantStatus(account={}){
  const card=account?.configuration?.merchant?.capabilities?.card_payments||{};
  const deadline=account?.requirements?.summary?.minimum_deadline||null;
  const futureDeadline=account?.future_requirements?.summary?.minimum_deadline||null;
  const cardPaymentsStatus=String(card.status||'unknown');
  const requirementsStatus=String(deadline?.status||'none');
  const futureRequirementsStatus=String(futureDeadline?.status||'none');
  const actionRequired=['currently_due','past_due'].includes(requirementsStatus)||cardPaymentsStatus==='restricted';
  const readyForPayments=cardPaymentsStatus==='active'&&!actionRequired;
  const onboardingState=readyForPayments?'ready':cardPaymentsStatus==='pending'?'under_review':actionRequired?'action_required':'incomplete';
  return {accountId:assertStripeConnectedAccountId(account.id),livemode:account.livemode===true,cardPaymentsStatus,requirementsStatus,futureRequirementsStatus,minimumDeadline:deadline?.time||null,onboardingState,readyForPayments,payoutsManagedByStripe:true,payoutsStatus:'managed_in_embedded_component',truth:readyForPayments?'STRIPE_CAPABILITY_ACTIVE':'STRIPE_REQUIREMENTS_PENDING'};
}
export function verifyStripeConnectWebhookSignature(raw,header,{secret,nowSeconds=Math.floor(Date.now()/1000),toleranceSeconds=300}={}){
  if(!secret||!/^whsec_/.test(secret))throw new Error('Stripe Connect webhook secret is not configured.');
  const parts=String(header||'').split(',').map(v=>v.trim());const timestamp=Number(parts.find(v=>v.startsWith('t='))?.slice(2));const signatures=parts.filter(v=>v.startsWith('v1=')).map(v=>v.slice(3));
  if(!Number.isFinite(timestamp)||Math.abs(nowSeconds-timestamp)>toleranceSeconds||signatures.length===0)throw new Error('Stripe Connect webhook signature is invalid.');
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');const ok=signatures.some(sig=>{try{return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}catch{return false;}});if(!ok)throw new Error('Stripe Connect webhook signature is invalid.');return {verified:true,timestamp};
}
