import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase/admin.js';
import { getMarketBillingRuntime } from '../../../config/market-billing-catalog.js';
import { assessMarketSalesClosure } from '../../../lib/market/market-sales-closure.js';

function reply(body,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'public, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}
export async function GET(){
  try{
    const sha=String(process.env.VERCEL_GIT_COMMIT_SHA||process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA||'').trim().toLowerCase();const ref=String(process.env.VERCEL_GIT_COMMIT_REF||'').trim();const env=String(process.env.VERCEL_ENV||'').trim();const admin=createAdminClient();
    const[{data:evidence,error:evidenceError},{count,error:providerError}]=await Promise.all([admin.from('market_launch_evidence').select('evidence_kind,production_sha,evidence_digest,verified,verified_at').eq('production_sha',sha),admin.from('market_provider_evidence').select('id',{count:'exact',head:true}).eq('production_sha',sha).eq('runtime_sha',sha).eq('evidence_class','PRODUCTION_REAL_OUTPUT')]);if(evidenceError||providerError)throw evidenceError||providerError;
    const assessment=assessMarketSalesClosure({productionSha:sha,runtimeSha:sha,evidenceRows:evidence||[],billingRuntime:getMarketBillingRuntime(),providerReceiptCount:Number(count)||0});return reply({ok:true,product:'LANERIQ AI',environment:env,ref,commitSha:sha,marketSellable:assessment.marketSellable,truth:assessment.truth,layers:assessment.layers,blockers:assessment.blockers,sandboxCommercialReady:assessment.sandboxCommercialReady});
  }catch(error){console.error('MARKET_READINESS_ERROR',error?.code||error?.name||'unknown');return reply({ok:false,marketSellable:false,truth:'MARKET_SALES_EVIDENCE_REQUIRED',blockers:['market-readiness-unavailable']},503);}
}
