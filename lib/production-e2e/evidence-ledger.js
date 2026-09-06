import crypto from "node:crypto";
import { assertExactProductionBuild } from "./build-identity.js";
import {
  createEvidenceRunRow,
  getEvidenceRunRow,
  updateEvidenceRunRow,
  latestPassedEvidenceRow,
  getOwnedAppSnapshot,
  getOwnedVersions,
  getOwnedBackendModel,
  getOwnedWorkflow,
  getOwnedWorkflowRun,
} from "../cloud-adapters/production-e2e-evidence-data.js";

export const PRODUCTION_CLOSURE_EVIDENCE_LEVEL="AUTHENTICATED_PRODUCTION_APP_BUILDER_FULL_CLOSURE_V3";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID=/^[A-Za-z0-9._:-]{1,160}$/;

function fail(message,status=409,code="EVIDENCE_VERIFICATION_FAILED"){
  const error=new Error(message);error.status=status;error.code=code;throw error;
}
function uuid(value,label){const text=String(value||"").trim();if(!UUID.test(text))fail(`${label} is invalid.`,400,"INVALID_EVIDENCE_ID");return text;}
function boundedText(value,max=300){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function bool(value){return value===true;}
function int(value,min=0,max=1_000_000){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):0;}
function stageKey(stage){return String(stage).padStart(2,"0");}
function mergeStage(row,stage,value){return {...(row.stage_evidence&&typeof row.stage_evidence==="object"?row.stage_evidence:{}),[stageKey(stage)]:value};}
function receipt(row){return {runId:row.id,evidenceLevel:row.evidence_level,status:row.status,highestStage:row.highest_stage,commitSha:row.commit_sha,completedAt:row.completed_at||null,reportDigest:row.report_digest||null};}

async function requireRunning(runId,userId){
  const row=await getEvidenceRunRow(uuid(runId,"Evidence run ID"),userId);
  if(!row)fail("Production evidence run was not found.",404,"EVIDENCE_RUN_NOT_FOUND");
  if(row.status!=="running")fail(`Production evidence run is already ${row.status}.`,409,"EVIDENCE_RUN_CLOSED");
  const build=assertExactProductionBuild();
  if(row.commit_sha!==build.commitSha)fail("Evidence run commit no longer matches the executing Production build.",409,"EVIDENCE_COMMIT_DRIFT");
  return {row,build};
}

export async function startProductionEvidenceRun(userId){
  const build=assertExactProductionBuild();
  const row=await createEvidenceRunRow({
    user_id:userId,
    commit_sha:build.commitSha,
    commit_ref:build.commitRef,
    environment:build.environment,
    evidence_level:PRODUCTION_CLOSURE_EVIDENCE_LEVEL,
    status:"running",
    highest_stage:0,
    stage_evidence:{},
  });
  return {success:true,receipt:receipt(row),build};
}

async function verifyStage(stage,input,userId,row,build){
  const appId=input?.appId?uuid(input.appId,"App ID"):row.app_id;
  if(stage===1)return {source:"server",exactProductionBuildVerified:true,commitSha:build.commitSha};
  if(stage===2){if(!bool(input?.planningVerified))fail("Planning completion was not reported.");return {source:"browser-api",planningVerified:true};}
  if(stage===3){if(!bool(input?.zeroSpendOnly)||Number(input?.aiCreditsCharged)!==0||Number(input?.projectCreditsCharged)!==0)fail("Zero-spend evidence is incomplete.");return {source:"browser-api",zeroSpendOnly:true,aiCreditsCharged:0,projectCreditsCharged:0};}
  if(stage===4||stage===5){
    const initialVersionId=uuid(input?.initialVersionId||row.initial_version_id,"Initial version ID");
    const app=await getOwnedAppSnapshot(appId,userId);if(!app)fail("Generated App is not owned by the authenticated user.");
    if(app.current_version_id!==initialVersionId)fail("Persisted initial version is not the App current version.");
    const versions=await getOwnedVersions(appId,userId);if(!versions.some(v=>v.id===initialVersionId))fail("Initial App version is not persisted.");
    if(stage===4&&input?.createRequestId){const requestId=boundedText(input.createRequestId,160);if(!REQUEST_ID.test(requestId)||app.generation_request_id!==requestId)fail("Generation request identity does not match the persisted App.");}
    return {source:"server-db",appOwned:true,initialVersionPersisted:true,currentVersionMatches:true,versionCount:versions.length};
  }
  if(stage===6){if(!bool(input?.appPreviewVerified)||!bool(input?.websitePreviewVerified))fail("Owner App and Website previews were not both verified.");return {source:"authenticated-browser",appPreviewVerified:true,websitePreviewVerified:true};}
  if(stage===7){
    const initialVersionId=uuid(input?.initialVersionId||row.initial_version_id,"Initial version ID"),modifiedVersionId=uuid(input?.modifiedVersionId,"Modified version ID");if(initialVersionId===modifiedVersionId)fail("AI Modify did not produce a distinct version.");
    const app=await getOwnedAppSnapshot(appId,userId),versions=await getOwnedVersions(appId,userId);if(!app||app.current_version_id!==modifiedVersionId)fail("Modified version is not the persisted current version.");
    if(!versions.some(v=>v.id===initialVersionId)||!versions.some(v=>v.id===modifiedVersionId))fail("Append-only initial/modified versions are incomplete.");
    if(Number(input?.userCreditsCharged)!==0)fail("AI Modify zero-user-credit evidence failed.");
    return {source:"server-db",distinctModifiedVersion:true,initialVersionRetained:true,modifiedVersionPersisted:true,userCreditsCharged:0,versionCount:versions.length};
  }
  if(stage===8){
    const initialVersionId=uuid(input?.initialVersionId||row.initial_version_id,"Initial version ID"),modifiedVersionId=uuid(input?.modifiedVersionId||row.modified_version_id,"Modified version ID"),currentVersionId=uuid(input?.currentVersionId,"Rollback version ID");
    if([initialVersionId,modifiedVersionId].includes(currentVersionId))fail("Undo rollback must append a third distinct version.");
    const app=await getOwnedAppSnapshot(appId,userId),versions=await getOwnedVersions(appId,userId);if(!app||app.current_version_id!==currentVersionId)fail("Rollback version is not current.");
    const ids=new Set(versions.map(v=>v.id));if(versions.length<3||![initialVersionId,modifiedVersionId,currentVersionId].every(id=>ids.has(id)))fail("Append-only rollback history is incomplete.");
    return {source:"server-db",appendOnlyRollbackVerified:true,versionCount:versions.length};
  }
  if(stage===9||stage===10){
    const model=await getOwnedBackendModel(appId,userId);if(!model||model.status!=="ready"||model.schema_json?.providerHidden!==true)fail("Provider-hidden Database model is not persisted.");
    const schema=model.schema_json||{},entities=Array.isArray(schema.entities)?schema.entities:[],history=Array.isArray(schema._history)?schema._history:[];
    if(entities.length<1)fail("Database model contains no safe entities.");
    if(stage===10){if(Number(schema.version)<3||history.length<1)fail("Database model version/rollback history is incomplete.");if(entities.some(entity=>String(entity?.name||"")==="closure_notes"))fail("Database rollback did not restore the pre-evolution schema.");}
    return {source:"server-db",providerHidden:true,modelVersion:int(schema.version,1,9999),historyDepth:history.length,entityCount:entities.length,physicalMigrationClaimed:false};
  }
  if(stage===11){
    const workflowId=uuid(input?.workflowId,"Workflow ID"),workflow=await getOwnedWorkflow(workflowId,appId,userId);if(!workflow||workflow.enabled!==true)fail("Owned Safe Test workflow is not active before execution.");
    const types=(Array.isArray(workflow.actions)?workflow.actions:[]).map(x=>String(x?.type||""));if(!types.length||types.some(type=>type!=="save_crm"))fail("Closure workflow contains an unexpected external action.");
    return {source:"server-db",workflowOwned:true,workflowEnabledBeforeSafeTest:true,actionTypes:types};
  }
  if(stage===12){
    const workflowId=uuid(input?.workflowId||row.workflow_id,"Workflow ID"),key=boundedText(input?.idempotencyKey,160);if(!REQUEST_ID.test(key))fail("Workflow Safe Test idempotency key is invalid.");
    const workflow=await getOwnedWorkflow(workflowId,appId,userId),run=await getOwnedWorkflowRun(workflowId,key,userId);if(!workflow||workflow.enabled!==false)fail("Closure workflow was not paused after Safe Test.");if(!run||run.status!=="completed"||run.trigger_payload?._safe_test!==true)fail("Persisted Workflow run is not a completed Safe Test.");
    const results=Array.isArray(run.action_results)?run.action_results:[];if(!results.length||results.some(result=>result?.status!=="simulated"))fail("Workflow Safe Test persisted a non-simulated action result.");
    return {source:"server-db",safeTestPersisted:true,idempotencyKeyVerified:true,workflowDisabledAfterTest:true,resultCount:results.length,externalActionsTriggered:false};
  }
  if(stage===13){if(int(input?.count,0,18)!==18||!bool(input?.allHealthy))fail("Authenticated 18-page browser evidence is incomplete.");return {source:"authenticated-browser",pageCount:18,allHealthy:true};}
  if(stage===14){if(!bool(input?.releaseReady))fail("Release readiness was not verified.");const versionId=uuid(input?.versionId||row.current_version_id,"Release version ID"),app=await getOwnedAppSnapshot(appId,userId);if(!app||app.current_version_id!==versionId)fail("Release gate version does not match persisted current version.");return {source:"browser-api+server-db",releaseReady:true,currentVersionPinned:true,overall:int(input?.overall,0,100)};}
  if(stage===15){if(!bool(input?.appNotFound)||!bool(input?.websiteNotFound)||bool(input?.appAuthRedirect)||bool(input?.websiteAuthRedirect))fail("Anonymous private baseline was not fail-closed 404.");return {source:"anonymous-browser",appPrivate404:true,websitePrivate404:true};}
  if(stage===16){const versionId=uuid(input?.currentVersionId||row.current_version_id,"Published version ID"),app=await getOwnedAppSnapshot(appId,userId);if(!app||app.publish_status!=="published"||app.published_version_id!==versionId)fail("Database does not show exact-version publish state.");return {source:"server-db",published:true,publishedVersionPinned:true};}
  if(stage===17){const appStatus=int(input?.appStatus,0,599),websiteStatus=int(input?.websiteStatus,0,599);if(appStatus<200||appStatus>=300||websiteStatus<200||websiteStatus>=300||int(input?.appBytes)<100||int(input?.websiteBytes)<100)fail("Anonymous public browser evidence is unhealthy.");return {source:"anonymous-browser",appStatus,websiteStatus,appBytes:int(input.appBytes),websiteBytes:int(input.websiteBytes)};}
  if(stage===18){
    const app=await getOwnedAppSnapshot(appId,userId);if(!app)fail("Final owned App state is unavailable.");const publicState=app.publish_status==="published"||app.visibility==="public"||app.visibility==="listed"||Boolean(app.published_version_id);if(publicState)fail("App remains public after Production closure cleanup.");
    if(!bool(input?.appNotFound)||!bool(input?.websiteNotFound))fail("Anonymous routes were not proven private after cleanup.");return {source:"server-db+anonymous-browser",databasePrivate:true,appPrivate404:true,websitePrivate404:true};
  }
  fail("Unsupported Production evidence stage.",400,"INVALID_EVIDENCE_STAGE");
}

export async function checkpointProductionEvidenceRun({runId,stage,input,userId}){
  const stageNumber=int(stage,0,18);if(stageNumber<1||stageNumber>18)fail("Evidence stage must be 1 through 18.",400,"INVALID_EVIDENCE_STAGE");
  const {row,build}=await requireRunning(runId,userId);
  if(stageNumber<=row.highest_stage)return {success:true,replayed:true,receipt:receipt(row),stageEvidence:row.stage_evidence?.[stageKey(stageNumber)]||null};
  if(stageNumber!==row.highest_stage+1)fail("Production evidence stages must be recorded sequentially.",409,"EVIDENCE_STAGE_GAP");
  const verified=await verifyStage(stageNumber,input||{},userId,row,build);
  const patch={highest_stage:stageNumber,stage_evidence:mergeStage(row,stageNumber,verified)};
  if(input?.appId)patch.app_id=uuid(input.appId,"App ID");
  if(input?.initialVersionId)patch.initial_version_id=uuid(input.initialVersionId,"Initial version ID");
  if(input?.modifiedVersionId)patch.modified_version_id=uuid(input.modifiedVersionId,"Modified version ID");
  if(input?.currentVersionId)patch.current_version_id=uuid(input.currentVersionId,"Current version ID");
  if(input?.workflowId)patch.workflow_id=uuid(input.workflowId,"Workflow ID");
  const updated=await updateEvidenceRunRow(row.id,userId,patch);
  return {success:true,replayed:false,receipt:receipt(updated),stageEvidence:verified};
}

export async function failProductionEvidenceRun({runId,userId,stage,code,message}){
  const row=await getEvidenceRunRow(uuid(runId,"Evidence run ID"),userId);if(!row)return {success:false,missing:true};if(row.status!=="running")return {success:true,alreadyClosed:true,receipt:receipt(row)};
  const failureStage=int(stage,0,18),updated=await updateEvidenceRunRow(row.id,userId,{status:"failed",failure_stage:failureStage,failure_code:boundedText(code||"CLIENT_RUN_FAILED",80),failure_message:boundedText(message||"Production closure failed.",500),completed_at:new Date().toISOString()});
  return {success:true,receipt:receipt(updated)};
}

export async function completeProductionEvidenceRun({runId,userId,report}){
  const {row}=await requireRunning(runId,userId);if(row.highest_stage!==18)fail("All 18 evidence stages must pass before a durable receipt can be issued.");
  if(report?.success!==true||report?.safety?.workflowExternalActionsTriggered!==false||report?.safety?.databasePhysicalMigrationClaimed!==false||report?.safety?.officialStoreSubmissionVerified!==false||report?.safety?.emailExercised!==false||report?.safety?.whatsappExercised!==false||report?.safety?.smsExercised!==false)fail("Final evidence report violates the Production truth boundary.");
  const app=await getOwnedAppSnapshot(row.app_id,userId);if(!app)fail("Final App state cannot be verified.");const publicState=app.publish_status==="published"||app.visibility==="public"||app.visibility==="listed"||Boolean(app.published_version_id);if(publicState)fail("Durable receipt cannot be issued while the test project is public.");
  const serialized=JSON.stringify(report);if(serialized.length>120000)fail("Final evidence report is too large.",413,"EVIDENCE_REPORT_TOO_LARGE");const digest=crypto.createHash("sha256").update(serialized).digest("hex");
  const updated=await updateEvidenceRunRow(row.id,userId,{status:"passed",report_digest:digest,completed_at:new Date().toISOString(),failure_stage:null,failure_code:null,failure_message:null});
  return {success:true,receipt:receipt(updated)};
}

export async function currentProductionEvidenceStatus(){
  const build=assertExactProductionBuild();const row=await latestPassedEvidenceRow(build.commitSha);
  return {ok:true,product:"LANERIQ AI",commitSha:build.commitSha,commitRef:build.commitRef,environment:build.environment,authenticatedClosure:{verified:Boolean(row),evidenceLevel:row?.evidence_level||PRODUCTION_CLOSURE_EVIDENCE_LEVEL,stageCount:row?.highest_stage||0,completedAt:row?.completed_at||null,reportDigest:row?.report_digest||null}};
}
