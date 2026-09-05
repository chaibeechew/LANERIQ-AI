import { createClient } from "../supabase/server.js";
import { createAdminClient } from "../supabase/admin.js";
import { sendLaneriqEmail } from "../email-provider/server.js";
import { isMobileGameIdea } from "../ai/mobile-game-knowledge.js";
import { BUYOUT_LICENSE_ISSUANCE_POLICY, buyoutPriceForTier } from "../../config/buyout-license-policy.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ok=(data)=>({ok:true,data});
const fail=(code,error=null)=>({ok:false,code,error});
const clean=(value,max=200)=>String(value||"").trim().slice(0,max);
const escapeHtml=(value)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

async function currentUser(){
  try{
    const client=await createClient();
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)return fail("AUTHENTICATION_REQUIRED");
    return {ok:true,client,user};
  }catch{return fail("AUTHENTICATION_REQUIRED");}
}
async function currentAdmin(){
  const auth=await currentUser();
  if(!auth.ok)return auth;
  if(String(auth.user.app_metadata?.role||"").toLowerCase()!=="admin")return fail("ADMIN_REQUIRED");
  return auth;
}
function publicBaseUrl(){
  const value=clean(process.env.LANERIQ_PUBLIC_URL||process.env.NEXT_PUBLIC_SITE_URL||"https://laneriq-ai.vercel.app",500);
  return /^https:\/\//i.test(value)?value.replace(/\/+$/g,""):"https://laneriq-ai.vercel.app";
}
function emailStatus(result){
  const status=String(result?.status||"").toLowerCase();
  if(status==="completed"||status==="sent"||status==="delivered")return "sent";
  if(status==="queued")return "queued";
  if(status==="deferred"||status==="integration_required")return "deferred";
  return "failed";
}

export async function loadOwnerBuyoutLicense({appId}={}){
  if(!UUID.test(String(appId||"")))return fail("INVALID_PROJECT_ID");
  const auth=await currentUser();if(!auth.ok)return auth;
  const [{data:app,error:appError},{data:license,error:licenseError}]=await Promise.all([
    auth.client.from("apps").select("id,name,owner_id,publish_status,source_prompt").eq("id",appId).eq("owner_id",auth.user.id).maybeSingle(),
    auth.client.from("app_licenses").select("id,app_id,owner_id,license_price,currency,terms_version,accepted_at,status,license_number,license_tier,certificate_version,issued_at,project_name_snapshot,email_delivery_status,email_message_id").eq("app_id",appId).eq("owner_id",auth.user.id).maybeSingle(),
  ]);
  if(appError)return fail("PROJECT_READ_FAILED",appError.message);
  if(!app)return fail("PROJECT_NOT_FOUND");
  if(licenseError)return fail("LICENSE_READ_FAILED",licenseError.message);
  return ok({
    project:{id:app.id,name:app.name,published:app.publish_status==="published"},
    license:license||null,
    policy:{
      prices:BUYOUT_LICENSE_ISSUANCE_POLICY.prices,
      gameProjectEligible:false,
      encourageCreatorSupportedProjectEligible:false,
      dashboardIsSourceOfTruth:true,
      emailFailureDoesNotInvalidateLicense:true,
    },
  });
}

async function deliverLicenseEmail({admin,app,license,ownerEmail}){
  if(!ownerEmail)return {status:"not_attempted",reason:"recipient_missing"};
  const dashboardUrl=`${publicBaseUrl()}/app-dashboard/${app.id}/license`;
  const projectName=license.project_name_snapshot||app.name||"LANERIQ AI Project";
  const tier=String(license.license_tier||"").toUpperCase();
  const price=Number(license.license_price||0).toFixed(2);
  const text=[
    "LANERIQ AI — BUYOUT LICENSE",
    "",
    `License ID: ${license.license_number}`,
    `Project: ${projectName}`,
    `Tier: ${tier}`,
    `License Fee: USD ${price}`,
    `Status: ${String(license.status||"active").toUpperCase()}`,
    `Issued: ${license.issued_at||license.accepted_at||""}`,
    `Terms Version: ${license.terms_version}`,
    "Future LANERIQ AI revenue share after this Buyout License: 0% for this licensed project, subject to the applicable license terms.",
    "",
    `View your permanent Dashboard copy: ${dashboardUrl}`,
    "",
    "Your Dashboard copy is the source of truth. Email delivery failure does not invalidate an already-issued active License.",
  ].join("\n");
  const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0d1713"><p style="letter-spacing:.12em;font-size:12px"><b>LANERIQ AI</b> · BUYOUT LICENSE</p><h1 style="font-size:30px">Your Buyout License is ready.</h1><div style="border:1px solid #d9c26d;border-radius:18px;padding:20px;background:#fbfaf5"><p><b>License ID:</b> ${escapeHtml(license.license_number)}</p><p><b>Project:</b> ${escapeHtml(projectName)}</p><p><b>Tier:</b> ${escapeHtml(tier)}</p><p><b>License Fee:</b> USD ${escapeHtml(price)}</p><p><b>Status:</b> ${escapeHtml(String(license.status||"active").toUpperCase())}</p><p><b>Terms:</b> ${escapeHtml(license.terms_version)}</p></div><p>Future LANERIQ AI revenue share after this Buyout License is <b>0%</b> for this licensed project, subject to the applicable license terms.</p><p><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#0b2119;color:white;text-decoration:none">View License in Dashboard</a></p><p style="font-size:12px;color:#66746e">Your Dashboard copy is the source of truth. If this email is delayed, your active License remains available in LANERIQ AI.</p></div>`;
  try{
    const result=await sendLaneriqEmail({to:ownerEmail,subject:`LANERIQ AI Buyout License · ${license.license_number}`,text,html,purpose:"transactional"});
    const status=emailStatus(result);
    await admin.from("app_licenses").update({email_delivery_status:status,email_message_id:result?.messageId||null,email_last_attempt_at:new Date().toISOString()}).eq("id",license.id);
    return {status,messageId:result?.messageId||null};
  }catch(error){
    await admin.from("app_licenses").update({email_delivery_status:"failed",email_last_attempt_at:new Date().toISOString()}).eq("id",license.id);
    return {status:"failed",reason:String(error?.message||"delivery_failed").slice(0,120)};
  }
}

export async function issueBuyoutLicenseAsAdmin({appId,tier,paymentReference,resendEmail=false}={}){
  if(!UUID.test(String(appId||"")))return fail("INVALID_PROJECT_ID");
  const normalizedTier=clean(tier,30).toLowerCase();
  try{buyoutPriceForTier(normalizedTier);}catch{return fail("INVALID_LICENSE_TIER");}
  const paymentRef=clean(paymentReference,200);
  if(!paymentRef)return fail("PAYMENT_REFERENCE_REQUIRED");
  const auth=await currentAdmin();if(!auth.ok)return auth;
  const admin=createAdminClient();
  const {data:app,error:appError}=await admin.from("apps").select("id,owner_id,name,source_prompt,publish_status").eq("id",appId).maybeSingle();
  if(appError)return fail("PROJECT_READ_FAILED",appError.message);
  if(!app)return fail("PROJECT_NOT_FOUND");
  if(app.publish_status==="published")return fail("BUYOUT_AFTER_PUBLISH_NOT_ALLOWED");
  if(isMobileGameIdea(app.source_prompt||""))return fail("GAME_BUYOUT_NOT_AVAILABLE");
  const {data:support,error:supportError}=await admin.from("creator_support_requests").select("id,status").eq("unfinished_project_id",appId).eq("status","redeemed").limit(1);
  if(supportError)return fail("CREATOR_SUPPORT_CHECK_FAILED",supportError.message);
  if((support||[]).length)return fail("ENCOURAGE_CREATOR_BUYOUT_NOT_AVAILABLE");

  const {data:issued,error:issueError}=await admin.rpc("admin_issue_buyout_license_v2",{p_admin_id:auth.user.id,p_app_id:appId,p_tier:normalizedTier,p_payment_reference:paymentRef});
  if(issueError)return fail("BUYOUT_LICENSE_ISSUE_FAILED",issueError.message);
  const {data:license,error:licenseError}=await admin.from("app_licenses").select("id,app_id,owner_id,license_price,currency,terms_version,accepted_at,status,license_number,license_tier,certificate_version,issued_at,project_name_snapshot,email_delivery_status,email_message_id").eq("app_id",appId).single();
  if(licenseError)return fail("LICENSE_READ_FAILED",licenseError.message);

  let delivery={status:license.email_delivery_status||"not_attempted",messageId:license.email_message_id||null};
  if(resendEmail||license.email_delivery_status!=="sent"){
    const {data:profile}=await admin.from("profiles").select("email").eq("id",app.owner_id).maybeSingle();
    delivery=await deliverLicenseEmail({admin,app,license,ownerEmail:profile?.email||null});
  }
  return ok({license:{...license,futureLaneriqRevenueSharePercent:0},replayed:Boolean(issued?.replayed),emailDelivery:delivery,dashboardPath:`/app-dashboard/${appId}/license`});
}
