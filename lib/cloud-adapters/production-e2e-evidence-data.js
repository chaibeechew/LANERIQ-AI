import { createClient } from "../supabase/server.js";
import { createAdminClient } from "../supabase/admin.js";

const TABLE="production_e2e_evidence_runs";
const RUN_COLUMNS="id,user_id,commit_sha,commit_ref,environment,evidence_level,status,highest_stage,app_id,initial_version_id,modified_version_id,current_version_id,workflow_id,stage_evidence,report_digest,failure_stage,failure_code,failure_message,started_at,updated_at,completed_at";

function admin(){return createAdminClient();}
function throwIf(error,label){if(error){const err=new Error(label);err.cause=error;throw err;}}

export async function resolveEvidencePrincipal(){
  const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user?.id)return null;
  return {userId:user.id};
}

export async function createEvidenceRunRow(values){
  const {data,error}=await admin().from(TABLE).insert(values).select(RUN_COLUMNS).single();
  throwIf(error,"Unable to create Production evidence run.");
  return data;
}

export async function getEvidenceRunRow(runId,userId){
  const {data,error}=await admin().from(TABLE).select(RUN_COLUMNS).eq("id",runId).eq("user_id",userId).maybeSingle();
  throwIf(error,"Unable to load Production evidence run.");
  return data||null;
}

export async function updateEvidenceRunRow(runId,userId,patch){
  const {data,error}=await admin().from(TABLE).update({...patch,updated_at:new Date().toISOString()}).eq("id",runId).eq("user_id",userId).select(RUN_COLUMNS).single();
  throwIf(error,"Unable to update Production evidence run.");
  return data;
}

export async function latestPassedEvidenceRow(commitSha){
  const {data,error}=await admin().from(TABLE).select("commit_sha,evidence_level,status,highest_stage,report_digest,completed_at").eq("commit_sha",commitSha).eq("status","passed").eq("highest_stage",18).order("completed_at",{ascending:false}).limit(1).maybeSingle();
  throwIf(error,"Unable to read Production evidence status.");
  return data||null;
}

export async function getOwnedAppSnapshot(appId,userId){
  if(!appId)return null;
  const {data,error}=await admin().from("apps").select("id,owner_id,current_version_id,published_version_id,publish_status,visibility,generation_request_id,created_at,updated_at").eq("id",appId).eq("owner_id",userId).maybeSingle();
  throwIf(error,"Unable to verify owned App state.");
  return data||null;
}

export async function getOwnedVersions(appId,userId){
  if(!appId)return [];
  const {data,error}=await admin().from("app_versions").select("id,app_id,version_no,created_by,created_at,source_request_id").eq("app_id",appId).order("version_no",{ascending:true});
  throwIf(error,"Unable to verify App versions.");
  return (data||[]).filter(row=>!row.created_by||row.created_by===userId);
}

export async function getOwnedBackendModel(appId,userId){
  if(!appId)return null;
  const {data,error}=await admin().from("app_backend_models").select("id,app_id,owner_id,schema_json,status,updated_at").eq("app_id",appId).eq("owner_id",userId).maybeSingle();
  throwIf(error,"Unable to verify Database model.");
  return data||null;
}

export async function getOwnedWorkflow(workflowId,appId,userId){
  if(!workflowId||!appId)return null;
  const {data,error}=await admin().from("app_workflows").select("id,app_id,owner_id,name,trigger_type,actions,enabled,updated_at").eq("id",workflowId).eq("app_id",appId).eq("owner_id",userId).maybeSingle();
  throwIf(error,"Unable to verify Workflow state.");
  return data||null;
}

export async function getOwnedWorkflowRun(workflowId,idempotencyKey,userId){
  if(!workflowId||!idempotencyKey)return null;
  const {data,error}=await admin().from("workflow_runs").select("id,workflow_id,owner_id,trigger_payload,action_results,status,idempotency_key,created_at,completed_at").eq("workflow_id",workflowId).eq("owner_id",userId).eq("idempotency_key",idempotencyKey).maybeSingle();
  throwIf(error,"Unable to verify Workflow Safe Test run.");
  return data||null;
}
