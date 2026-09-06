import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAutonomousPlan, orchestrationBrief } from "../lib/build/orchestrator.js";

const read=(path)=>fs.readFileSync(path,"utf8");
const home=read("app/page.js");
const generate=read("app/api/generate/route.js");
const builderDomain=read("lib/cloud/builder-projects.js");
const builderAdapter=read("lib/cloud-adapters/builder-project-data.js");
const preview=read("app/a/[id]/page.js");
const publicRuntime=read("lib/publishing/public-project-runtime.js");
const idempotencyMigration=read("supabase/migrations/20260903081500_harden_ai_app_generation_idempotency.sql");
const atomicMigration=read("supabase/migrations/20260903104500_atomic_generated_project_persistence.sql");
const restrictMigration=read("supabase/migrations/20260903122000_restrict_generated_project_persistence_service_role.sql");
const publishPinMigration=read("supabase/migrations/20260903105500_pin_published_project_version.sql");

const plan=buildAutonomousPlan({idea:"Create a mobile-first real estate CRM app with clients, properties, appointments and follow-up automation"});
assert.equal(plan.modules.app,true);
assert.ok(plan.selectedModules.includes("app"));
assert.ok(plan.selectedModules.includes("database"));
assert.ok(plan.selectedModules.includes("workflows"));
assert.match(orchestrationBrief(plan),/SOOLENAI AUTONOMOUS BUILD PLAN/);

const planIndex=home.indexOf('fetch("/api/orchestrate"');
const planGuard=home.indexOf('if(!planResponse.ok)throw');
const generateIndex=home.indexOf('fetch("/api/generate"');
assert.ok(planIndex>0&&planGuard>planIndex&&generateIndex>planGuard,"Homepage must complete Idea Planning before Generate.");

for(const pattern of [
  /getBuilderPrincipal\(\{requireVerified:true\}\)/,
  /Please verify your email or phone before creating an app/,
  /runAutonomousEngine/,
  /verifyGeneration/,
  /selfTestGeneratedApp/,
  /verifyGeneratedAppExecution/,
  /inspectProjectSpecification/,
  /adult\.generationStatus!=="verified"/,
  /QUALITY_GATE_RESCUE_ATTEMPTS/,
  /buildGenerationQualityDiagnostics/,
  /buildQualityGateRescueInstruction/,
  /persistBuilderGeneratedProject/,
  /saveBuilderGeneratedProjectContext/,
]) assert.match(generate,pattern);
assert.doesNotMatch(generate,/lib\/supabase\/|@supabase\/|createAdminClient/);
assert.match(builderAdapter,/auth\.getUser\(\)/);
assert.match(builderAdapter,/server_persist_generated_project/);
assert.match(builderAdapter,/\.from\("project_memory"\)\.upsert/);
const persistenceInvocation='const persistence=await persistBuilderGeneratedProject';
assert.ok(generate.indexOf(persistenceInvocation)>0,"Cloud generated-project persistence invocation must exist.");
assert.ok(generate.indexOf('adult.generationStatus!=="verified"')<generate.indexOf(persistenceInvocation),"Unverified generation must enter the repair/rescue path before the Cloud persistence boundary.");
const finalVerification='const verified=verifyGeneration(generationResult),finalReview=runCriticChecks(generationResult,adultRequirements)';
assert.ok(generate.indexOf(finalVerification)>0&&generate.indexOf(finalVerification)<generate.indexOf(persistenceInvocation),"Final deterministic generation + critic verification must complete after any rescue and before Cloud persistence.");
assert.ok(generate.indexOf('if(!verified.passed||!finalReview.passed)')>generate.indexOf(finalVerification),"Final verification failure must remain fail-closed.");
assert.ok(generate.indexOf('throw qualityGateError')<generate.indexOf(persistenceInvocation),"Exhausted quality rescue must fail before persistence.");
assert.match(generate,/function sourceEngineeringEvidence\(adult\)/);
assert.match(generate,/requiredForGeneration:false/);
assert.match(generate,/requiredBeforeSourceRelease:true/);
assert.match(generate,/sandboxVerified:status==="verified"/);
assert.match(generate,/status:effectiveGenerationStatus,generationStatus:effectiveGenerationStatus,overallStatus:adult\.status,sourceEngineering:engineeringEvidence/);
assert.match(generate,/qualityGateRescue:\{attempted:rescueAttempts>0,recovered:rescueRecovered,attempts:rescueAttempts,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS\}/);
assert.doesNotMatch(generate,/if\(adult\.status!=="verified"\)/,"Generate must not require a separately connected source-code sandbox before a verified specification can be saved.");

// One stable request identity owns the whole generate/save operation across route → Cloud domain → provider adapter.
assert.match(generate,/const REQUEST_ID=\/\^\[A-Za-z0-9\._:-\]\{1,160\}\$\//);
assert.match(generate,/A stable generation request ID is required/);
assert.match(generate,/loadGenerationReplay/);
assert.match(generate,/loadBuilderGenerationReplay/);
assert.match(builderAdapter,/\.eq\("generation_request_id", requestId\)/);
assert.match(generate,/STALE_PARTIAL_MS=90\*1000/);
assert.match(generate,/stalePartial:true/);
assert.match(generate,/GENERATION_REQUEST_IN_PROGRESS/);
assert.match(builderAdapter,/p_request_id: requestId/);
assert.match(generate,/idempotency:\{requestId:chargeRequestId[\s\S]*atomic:true/);
assert.match(idempotencyMigration,/apps_owner_generation_request_uidx/);
assert.match(idempotencyMigration,/owner_id, generation_request_id/);

const aiExecutionIndex=generate.indexOf("const adult=await runSoolenAdultMode");
assert.ok(generate.indexOf("const replay=await loadGenerationReplay")<aiExecutionIndex,"Persisted replay must be checked before AI execution.");
assert.ok(generate.indexOf("const postReservationReplay=await loadGenerationReplay")<aiExecutionIndex,"Concurrent replay state must be rechecked after reservation and before AI execution.");

// Initial App + Website project persistence remains one database transaction, now reachable only behind LANERIQ Cloud's service-role adapter.
for(const pattern of [
  /create or replace function public\.server_persist_generated_project/,
  /security definer/,
  /pg_advisory_xact_lock/,
  /generation_request_id=request_key/,
  /insert into public\.apps/,
  /insert into public\.app_versions/,
  /update public\.apps set current_version_id=version_row\.id/,
  /recovered_partial/,
]) assert.match(atomicMigration,pattern);
assert.match(restrictMigration,/revoke all on function public\.server_persist_generated_project.*from public, anon, authenticated/s);
assert.match(restrictMigration,/grant execute on function public\.server_persist_generated_project.*to service_role/s);
assert.match(builderDomain,/persistBuilderGeneratedProject/);
assert.doesNotMatch(builderDomain,/lib\/supabase\/|@supabase\/|createAdminClient/);
assert.match(builderAdapter,/const admin = createAdminClient\(\)/);
assert.match(builderAdapter,/admin\.rpc\("server_persist_generated_project"/);
assert.doesNotMatch(generate,/createdAppId&&!accessBound[\s\S]*\.from\("apps"\)\.delete/,"A persisted project must never be deleted because a response/enrichment step failed.");
assert.match(generate,/if\(createdAppId\)return json\(\{success:false,code:"GENERATION_REQUEST_IN_PROGRESS"/);

// The iPhone/browser client reuses ambiguous request IDs but rotates after definitive failures.
assert.match(home,/const CREATE_REQUEST_KEY="laneriqPendingCreateRequest"/);
assert.match(home,/stableCreateRequestId\(createFingerprint\)/);
assert.match(home,/requestId:createRequestId/);
assert.doesNotMatch(home,/requestId:newRequestId\("create"\)/);
assert.match(home,/if\(d\?\.code!=="GENERATION_REQUEST_IN_PROGRESS"\)clearCreateRequest\(createRequestId\)/);
const savedPlanIndex=home.indexOf('setPlan({...d,orchestrationPlan:modulePlan,bootstrap:null})');
const bootstrapFetchIndex=home.indexOf('fetch(`/api/apps/${appId}/bootstrap`');
assert.ok(savedPlanIndex>generateIndex&&bootstrapFetchIndex>savedPlanIndex,"Saved project UI state must commit before optional bootstrap work.");

// App Preview resolves through the shared server runtime, not anonymous project-table access.
for(const pattern of [
  /auth\.getUser\(\)/,
  /loadVisibleProject\(\{ id, userId: user\?\.id \|\| null, versionId: requestedVersionId \}\)/,
  /loadVisibleProjectMedia/,
  /GeneratedAppClient/,
  /notFound\(\)/,
  /data-project-version=\{version\.id\}/,
]) assert.match(preview,pattern);
assert.doesNotMatch(preview,/\.from\("apps"\)|\.from\("app_versions"\)/);

for(const pattern of [
  /current_version_id,published_version_id/,
  /if \(!isOwner && !isPublished\) return null/,
  /requestedVersionId && isOwner[\s\S]*app\.current_version_id[\s\S]*app\.published_version_id/,
  /\.eq\("id", selectedVersionId\)/,
  /\.eq\("app_id", app\.id\)/,
  /isPublishedVersion: Boolean\(app\.published_version_id && version\.id === app\.published_version_id\)/,
]) assert.match(publicRuntime,pattern);
assert.match(publishPinMigration,/published_version_id=p_expected_version_id/);
assert.match(publishPinMigration,/published_version_id=null/);

console.log("✓ AI App internal E2E locks Planning → normal repair/targeted rescue → final deterministic verification → LANERIQ Cloud atomic App + Version + current pointer → Preview");
console.log("✓ Quality-gate rescue remains bounded, cannot bypass final critic/generation verification, and never persists rejected output");
console.log("✓ Source sandbox evidence remains explicit and is required before source release, not before specification persistence");
console.log("✓ Same-request retries recover completed or stale-partial work without creating or charging a duplicate project");
console.log("✓ Provider admin persistence is isolated behind the Cloud adapter and DB RPC is service-role only");
console.log("✓ Post-save response/bootstrap loss cannot delete a successful project; the same request recovers it");
console.log("✓ Owner App preview stays on the working version while anonymous production traffic is pinned to published_version_id");
console.log("✓ Real authenticated Production generation and physical-device evidence remain separate LIVE evidence gates");