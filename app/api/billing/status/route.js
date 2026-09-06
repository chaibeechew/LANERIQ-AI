import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.js';
import { getMarketBillingRuntime } from '../../../../config/market-billing-catalog.js';

function reply(body,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}
export async function GET(){
  try{
    const client=await createClient();const{data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Authentication required.'},401);const admin=createAdminClient();
    const[{data:access,error:accessError},{data:grants,error:grantError}]=await Promise.all([admin.from('app_builder_account_access').select('standard_project_credits,pro_valid_from,pro_valid_until,game_access_plan').eq('user_id',user.id).maybeSingle(),admin.from('market_access_grants').select('sku,grant_type,valid_from,valid_until,state,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)]);if(accessError||grantError)throw accessError||grantError;
    const runtime=getMarketBillingRuntime();return reply({ok:true,access:access||{standard_project_credits:0,pro_valid_from:null,pro_valid_until:null,game_access_plan:'professional'},marketGrants:grants||[],billing:{livemode:runtime.live,checkoutConfigured:runtime.configured&&runtime.liveCatalogReady,marketLaunchApproved:runtime.launchApproved},clientCanGrantEntitlement:false});
  }catch(error){console.error('MARKET_BILLING_STATUS_ERROR',error?.code||error?.name||'unknown');return reply({error:'Billing status is temporarily unavailable.'},503);}
}
