import { NextResponse } from "next/server";
import { currentProductionEvidenceStatus } from "../../../../lib/production-e2e/evidence-ledger.js";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const value=await currentProductionEvidenceStatus();
    return NextResponse.json(value,{status:200,headers:{"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow, noarchive"}});
  }catch(error){
    return NextResponse.json({ok:false,product:"LANERIQ AI",code:error?.code||"EVIDENCE_STATUS_UNAVAILABLE",error:"Exact Production evidence status is unavailable for this deployment."},{status:Number(error?.status)||409,headers:{"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow, noarchive"}});
  }
}
