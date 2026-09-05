import { createClient } from "../supabase/server.js";
import { createAdminClient } from "../supabase/admin.js";

const ok=(data)=>({ok:true,data});
const fail=(code,error=null)=>({ok:false,code,error});
async function currentUser(){try{const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return fail("AUTHENTICATION_REQUIRED");return {ok:true,client,user};}catch{return fail("AUTHENTICATION_REQUIRED");}}
async function currentAdmin(){const auth=await currentUser();if(!auth.ok)return auth;if(String(auth.user.app_metadata?.role||"").toLowerCase()!=="admin")return fail("ADMIN_REQUIRED");return auth;}

export function createCreatorSupportDataAdapter(){
  return Object.freeze({
    async loadCreatorSupportStatus(){
      const auth=await currentUser();if(!auth.ok)return auth;
      const {data,error}=await auth.client.rpc("get_creator_support_status");if(error)return fail("CREATOR_SUPPORT_STATUS_FAILED",error.message);
      return ok({...data,showButton:Boolean(data?.freeAccessUsed&&data?.hasUnfinishedProject)});
    },
    async submitCreatorSupportRequest({reason="",individualAttested=false}={}){
      const auth=await currentUser();if(!auth.ok)return auth;
      const {data,error}=await auth.client.rpc("request_creator_support",{p_reason:String(reason||"").trim().slice(0,800)||null,p_individual_attested:individualAttested===true});
      if(error)return fail("CREATOR_SUPPORT_REQUEST_REJECTED",error.message);return ok(data);
    },
    async redeemCreatorSupportCode({code=""}={}){
      const auth=await currentUser();if(!auth.ok)return auth;
      const normalized=String(code||"").trim().toUpperCase();if(!/^CREATOR-[A-F0-9]{12}$/.test(normalized))return fail("INVALID_CREATOR_SUPPORT_CODE","Invalid Creator Support code.");
      const {data,error}=await auth.client.rpc("redeem_creator_support_code",{p_code:normalized});if(error)return fail("CREATOR_SUPPORT_REDEEM_REJECTED",error.message);return ok(data);
    },
    async loadCreatorSupportAdmin(){
      const auth=await currentAdmin();if(!auth.ok)return auth;
      const admin=createAdminClient();
      const [{data:settings,error:settingsError},{data:requests,error:requestsError}]=await Promise.all([
        admin.from("creator_support_settings").select("approval_mode,extension_months,code_valid_days,updated_at").eq("singleton_id",1).single(),
        admin.from("creator_support_requests").select("id,user_id,unfinished_project_id,reason,individual_attested,status,approval_mode,decision_reason,requested_at,decided_at,decided_by,redeemed_at").order("requested_at",{ascending:false}).limit(500),
      ]);
      if(settingsError||requestsError)return fail("CREATOR_SUPPORT_ADMIN_READ_FAILED",(settingsError||requestsError)?.message);
      const ids=(requests||[]).map(item=>item.id);let codes=[];
      if(ids.length){const {data,error}=await admin.from("creator_support_codes").select("request_id,code,issued_mode,issued_at,valid_until,redeemed_at,revoked_at").in("request_id",ids);if(error)return fail("CREATOR_SUPPORT_CODE_READ_FAILED",error.message);codes=data||[];}
      const byRequest=new Map(codes.map(item=>[item.request_id,item]));
      return ok({settings,requests:(requests||[]).map(item=>({...item,code:byRequest.get(item.id)||null}))});
    },
    async setCreatorSupportApprovalMode({mode}={}){
      const auth=await currentAdmin();if(!auth.ok)return auth;if(!["auto","manual"].includes(mode))return fail("INVALID_APPROVAL_MODE");
      const admin=createAdminClient();
      const {data,error}=await admin.rpc("admin_set_creator_support_mode_v2",{p_admin_id:auth.user.id,p_mode:mode});if(error)return fail("CREATOR_SUPPORT_MODE_FAILED",error.message);return ok(data);
    },
    async reviewCreatorSupportRequest({requestId,decision,reason=""}={}){
      const auth=await currentAdmin();if(!auth.ok)return auth;
      if(!/^[0-9a-f-]{36}$/i.test(String(requestId||""))||!["approve","reject"].includes(decision))return fail("INVALID_REVIEW_REQUEST");
      const admin=createAdminClient();
      const {data,error}=await admin.rpc("admin_review_creator_support_v2",{p_admin_id:auth.user.id,p_request_id:requestId,p_decision:decision,p_reason:String(reason||"").slice(0,500)||null});if(error)return fail("CREATOR_SUPPORT_REVIEW_FAILED",error.message);return ok(data);
    },
    async loadProjectMigrationAgreement({appId}={}){
      const auth=await currentUser();if(!auth.ok)return auth;
      const {data,error}=await auth.client.rpc("get_project_migration_agreement",{p_app_id:appId});if(error)return fail("MIGRATION_AGREEMENT_READ_FAILED",error.message);return ok(data);
    },
    async signProjectMigrationAgreement({appId,termsVersion,acknowledge10Percent,acknowledgeContinuingShare,acknowledgeCustomerOwnership}={}){
      const auth=await currentUser();if(!auth.ok)return auth;
      if(acknowledge10Percent!==true||acknowledgeContinuingShare!==true||acknowledgeCustomerOwnership!==true)return fail("MIGRATION_ACKNOWLEDGEMENTS_REQUIRED");
      const {data,error}=await auth.client.rpc("sign_project_migration_agreement",{p_app_id:appId,p_terms_version:String(termsVersion||"LANERIQ-PORTABILITY-10PCT-v1").trim(),p_acknowledge_10_percent:true});
      if(error)return fail("MIGRATION_AGREEMENT_SIGN_FAILED",error.message);
      return ok({...data,notice:"You keep ownership and may migrate the project externally. The signed 10% project software revenue-share obligation continues after migration."});
    },
  });
}
