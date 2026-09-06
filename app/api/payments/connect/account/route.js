import {NextResponse} from 'next/server.js';
import {createClient} from '../../../../../lib/supabase/server.js';
import {createAdminClient} from '../../../../../lib/supabase/admin.js';
import {normalizeConnectSetupInput,getCustomerPaymentConnectRuntime} from '../../../../../config/customer-payment-connect-policy.js';
import {createStripeConnectedMerchant,retrieveStripeConnectedMerchant,normalizeStripeMerchantStatus} from '../../../../../lib/payments/stripe-connect.js';
import {getCustomerConnectAccount,saveCustomerConnectAccount} from '../../../../../lib/payments/customer-connect-store.js';

const MAX_BODY=8192;
function json(body,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0'}});}
function trustedOrigin(request){const origin=String(request.headers.get('origin')||'');if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}}
async function currentUser(){const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user?.id)return null;return user;}
async function syncExisting(userId,row){const remote=await retrieveStripeConnectedMerchant(row.stripe_account_id);const status=normalizeStripeMerchantStatus(remote);await saveCustomerConnectAccount({userId,status});return status;}

export async function GET(){try{const user=await currentUser();if(!user)return json({ok:false,error:'Authentication required.'},401);const runtime=getCustomerPaymentConnectRuntime();const row=await getCustomerConnectAccount(user.id);if(!row)return json({ok:true,state:'not_started',configured:runtime.configured,live:runtime.live,readyForPayments:false});if(!runtime.configured)return json({ok:true,state:row.onboarding_state||'incomplete',configured:false,live:row.livemode===true,readyForPayments:false,accountId:row.stripe_account_id});const status=await syncExisting(user.id,row);return json({ok:true,...status,configured:true});}catch(error){return json({ok:false,error:String(error?.message||'Connect status unavailable.').slice(0,220)},Number(error?.status)||503);}}

export async function POST(request){try{
  if(!trustedOrigin(request))return json({ok:false,error:'Trusted same-origin request required.'},403);
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_BODY)return json({ok:false,error:'Request is too large.'},413);
  const user=await currentUser();if(!user)return json({ok:false,error:'Authentication required.'},401);
  if(!user.email||(!user.email_confirmed_at&&!user.confirmed_at))return json({ok:false,error:'Account verification required.'},403);
  const runtime=getCustomerPaymentConnectRuntime();if(!runtime.configured)return json({ok:false,error:'Stripe Connect is not configured.'},503);
  const input=normalizeConnectSetupInput(await request.json().catch(()=>({})));
  const existing=await getCustomerConnectAccount(user.id);if(existing){const status=await syncExisting(user.id,existing);return json({ok:true,reused:true,...status});}
  let app=null;if(input.appId){const admin=createAdminClient();const {data}=await admin.from('apps').select('id,name,description').eq('id',input.appId).eq('owner_id',user.id).maybeSingle();app=data||null;}
  const displayName=input.displayName||String(app?.name||user.email.split('@')[0]||'LANERIQ Creator').slice(0,120);
  const remote=await createStripeConnectedMerchant({userId:user.id,email:user.email,displayName,country:input.country,locale:input.locale});
  const status=normalizeStripeMerchantStatus(remote);await saveCustomerConnectAccount({userId:user.id,status});
  return json({ok:true,created:true,...status,autoPrefilled:{contactEmail:true,displayName:true,country:Boolean(input.country)},sensitiveKycStoredByLaneriq:false});
}catch(error){return json({ok:false,error:String(error?.message||'Connect setup failed.').slice(0,220)},Number(error?.status)||503);}}
}
