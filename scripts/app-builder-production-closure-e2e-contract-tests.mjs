import assert from "node:assert/strict";
import fs from "node:fs";
import { isPublicAccountPath } from "../lib/auth/session-safety.js";
import { LANERIQ_18_PAGES } from "../lib/product/laneriq-18-page-master.js";

const route=fs.readFileSync("app/production-closure-e2e/route.js","utf8");
const client=fs.readFileSync("public/production-closure-e2e-v3.js","utf8");
const buildIdentity=fs.readFileSync("lib/production-e2e/build-identity.js","utf8");
const ledger=fs.readFileSync("lib/production-e2e/evidence-ledger.js","utf8");
const principal=fs.readFileSync("lib/production-e2e/principal.js","utf8");
const adapter=fs.readFileSync("lib/cloud-adapters/production-e2e-evidence-data.js","utf8");
const ledgerApi=fs.readFileSync("app/api/production-e2e/evidence-ledger/route.js","utf8");
const statusApi=fs.readFileSync("app/api/production-e2e/evidence-status/route.js","utf8");
const migration=fs.readFileSync("supabase/migrations/20260905151143_production_e2e_evidence_ledger.sql","utf8");
const denyMigration=fs.readFileSync("supabase/migrations/20260905151212_production_e2e_evidence_ledger_deny_direct_access.sql","utf8");

assert.equal(isPublicAccountPath("/production-closure-e2e"),false,"Full App Builder Production closure must remain behind the normal authenticated account boundary.");
assert.equal(LANERIQ_18_PAGES.length,18,"Production closure must probe the canonical 18-page product definition.");

for(const pattern of [
  /LANERIQ_18_PAGES/,
  /getProductionBuildIdentity/,
  /dynamic\s*=\s*"force-dynamic"/,
  /Production closure evidence is locked/,
  /cannot execute Generate, Modify, Database, Workflow, Publish or Unpublish evidence/,
  /X-Robots-Tag/,
  /noindex, nofollow, noarchive/,
  /production-closure-e2e-v3\.js/,
  /laneriq-production-build/,
  /laneriq-production-surfaces/,
  /RUN 18-STAGE PRODUCTION CLOSURE \+ SAVE RECEIPT/,
  /Durable evidence receipt/,
  /LANERIQ_18_PAGES\.map/,
])assert.match(route,pattern);

for(const pattern of [
  /VERCEL_GIT_COMMIT_SHA/,
  /VERCEL_GIT_COMMIT_REF/,
  /VERCEL_ENV/,
  /environment==="production"/,
  /commitRef==="main"/,
  /COMMIT_SHA\.test\(commitSha\)/,
  /PRODUCTION_IDENTITY_REQUIRED/,
])assert.match(buildIdentity,pattern);

const stageMarkers=[
  "1/18 Verifying exact Production main SHA",
  "2/18 Planning the App + Website",
  "3/18 Reserving zero-spend creation entitlement",
  "4/18 Generating and atomically saving App + Website",
  "5/18 Verifying persisted initial version",
  "6/18 Verifying owner App + Website previews",
  "7/18 Applying a no-user-credit AI modification and saving version 2",
  "8/18 Verifying append-only Version History and Undo rollback",
  "9/18 Building the safe no-code Database model",
  "10/18 Evolving and rolling back the Database model safely",
  "11/18 Creating an owned Safe Test workflow",
  "12/18 Running workflow Safe Test, replaying idempotently, then pausing it",
  "13/18 Verifying all 18 authenticated LANERIQ product routes",
  "14/18 Rechecking exact-current-version 100/100 release gate",
  "15/18 Proving anonymous private baseline",
  "16/18 Publishing the exact reviewed current version",
  "17/18 Verifying anonymous public App + Website",
  "18/18 Unpublishing and proving private state again",
];
const orderedStages=stageMarkers.map(marker=>client.indexOf(marker));
assert.ok(orderedStages.every(index=>index>0),"Every 18-stage Production closure marker must exist exactly in client source.");
for(let i=1;i<orderedStages.length;i+=1)assert.ok(orderedStages[i]>orderedStages[i-1],`Production closure stage ${i+1} must occur after stage ${i}.`);

for(const pattern of [
  /\/api\/production-e2e\/evidence-ledger/,
  /ledger\("start"\)/,
  /ledger\("checkpoint"/,
  /ledger\("complete"/,
  /ledger\("fail"/,
  /evidenceRunId/,
  /Server ledger/,
  /reportVersion:3/,
  /AUTHENTICATED_PRODUCTION_APP_BUILDER_FULL_CLOSURE_V3/,
  /action:"reserve"/,
  /action:"release"/,
  /reservationHeld=true/,
  /reservationHeld=false/,
  /zeroSpendOnly!==true/,
  /aiCreditsCharged!==0/,
  /projectCreditsCharged!==0/,
  /requestId:createId/,
  /\/api\/modify/,
  /expectedVersionId:initialVersionId/,
  /userCreditsCharged:modifyCredits/,
  /expectedCurrentVersionId:modifiedVersionId/,
  /rollbackVersions\.length<3/,
  /providerHidden!==true/,
  /closure_notes/,
  /database\/rollback/,
  /type:"save_crm"/,
  /dryRun:true/,
  /workflowReplay\.replayed!==true/,
  /enabled:false/,
  /SURFACE_PAGES\.length!==18/,
  /\/api\/templates\?limit=1/,
  /surfaceEvidence\.count!==18/,
  /quality\.releaseReady!==true/,
  /quality\.version\.id!==versionId/,
  /credentials:"omit"/,
  /before\.app\.notFound/,
  /before\.website\.notFound/,
  /publish\.app\.published_version_id!==versionId/,
  /during\.app/,
  /during\.website/,
  /"unpublish"/,
  /publicState\(finalDetail\.app\)/,
  /after\.app\.notFound/,
  /after\.website\.notFound/,
  /closure-finally-unpublish/,
  /workflowExternalActionsTriggered:false/,
  /databasePhysicalMigrationClaimed:false/,
  /physicalDeviceVerified:false/,
  /originalGenerationProviderVerified:false/,
  /officialStoreSubmissionVerified:false/,
  /emailExercised:false/,
  /whatsappExercised:false/,
  /smsExercised:false/,
])assert.match(client,pattern);

for(const forbidden of [
  /createClient\s*\(/,
  /SUPABASE_SERVICE_ROLE/i,
  /SUPABASE_SECRET_KEY/i,
  /service[_-]?role/i,
  /signInWithOtp|verifyOtp|phone-auth|sms-auth|send_sms|sendSms/i,
  /officialStoreSubmissionVerified:true/,
  /originalGenerationProviderVerified:true/,
  /physicalDeviceVerified:true/,
  /workflowExternalActionsTriggered:true/,
  /databasePhysicalMigrationClaimed:true/,
  /\/api\/credits/,
  /consumeAiCredits/,
  /standard_project_credits/,
  /type:"send_email"/,
  /type:"send_whatsapp"/,
  /type:"calendar"/,
])assert.doesNotMatch(client,forbidden);

for(const pattern of [
  /PRODUCTION_CLOSURE_EVIDENCE_LEVEL/,
  /startProductionEvidenceRun/,
  /checkpointProductionEvidenceRun/,
  /failProductionEvidenceRun/,
  /completeProductionEvidenceRun/,
  /currentProductionEvidenceStatus/,
  /stageNumber!==row\.highest_stage\+1/,
  /getOwnedAppSnapshot/,
  /getOwnedVersions/,
  /getOwnedBackendModel/,
  /getOwnedWorkflow/,
  /getOwnedWorkflowRun/,
  /trigger_payload\?\._safe_test!==true/,
  /result\?\.status!=="simulated"/,
  /workflow\.enabled!==false/,
  /app\.published_version_id!==versionId/,
  /Boolean\(app\.published_version_id\)/,
  /crypto\.createHash\("sha256"\)/,
  /serialized\.length>120000/,
  /status:"passed"/,
])assert.match(ledger,pattern);
assert.doesNotMatch(ledger,/supabase\/admin|@supabase|createAdminClient/,"Provider-opaque evidence domain must not import Supabase directly.");
assert.match(principal,/cloud-adapters\/production-e2e-evidence-data\.js/);
assert.doesNotMatch(principal,/lib\/supabase\/|@supabase\/|createAdminClient/,"Evidence principal domain must stay provider opaque.");

for(const pattern of [
  /createClient/,
  /\.\.\/supabase\/server\.js/,
  /auth\.getUser\(\)/,
  /createAdminClient/,
  /production_e2e_evidence_runs/,
  /\.eq\("user_id",userId\)/,
  /\.eq\("owner_id",userId\)/,
  /app_versions/,
  /app_backend_models/,
  /app_workflows/,
  /workflow_runs/,
  /idempotency_key/,
])assert.match(adapter,pattern);

for(const pattern of [
  /sameOrigin\(request\)/,
  /readBoundedJson\(request,MAX_BYTES\)/,
  /getProductionEvidencePrincipal/,
  /principal\?\.userId/,
  /action==="start"/,
  /action==="checkpoint"/,
  /action==="fail"/,
  /action==="complete"/,
])assert.match(ledgerApi,pattern);
assert.doesNotMatch(ledgerApi,/lib\/supabase\/|@supabase\/|createClient\s*\(|SERVICE_ROLE|SECRET_KEY/,"Evidence API route must stay outside direct provider coupling.");
assert.doesNotMatch(ledgerApi,/userId\s*:\s*body|body\?\.userId/,"Authenticated evidence API must derive user identity only from the signed-in server principal.");

for(const pattern of [
  /currentProductionEvidenceStatus/,
  /Cache-Control/,
  /no-store/,
  /noindex, nofollow, noarchive/,
])assert.match(statusApi,pattern);
assert.doesNotMatch(statusApi,/user_id|app_id|workflow_id/,"Public exact-SHA status must never expose user or project identifiers.");

for(const pattern of [
  /create table if not exists public\.production_e2e_evidence_runs/,
  /user_id uuid not null references auth\.users/,
  /commit_sha text not null/,
  /highest_stage smallint/,
  /stage_evidence jsonb/,
  /report_digest text/,
  /enable row level security/,
  /revoke all on table public\.production_e2e_evidence_runs from public, anon, authenticated/,
  /grant select, insert, update on table public\.production_e2e_evidence_runs to service_role/,
  /No raw prompts, credentials, provider secrets, user email, or external message contents/,
])assert.match(migration,pattern);
for(const pattern of [/to anon[\s\S]*using \(false\)[\s\S]*with check \(false\)/,/to authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/])assert.match(denyMigration,pattern);

for(const pattern of [/safe-area-inset-top/,/safe-area-inset-bottom/,/min-height:50px/,/font-size:16px/,/touch-action:manipulation/,/focus-visible/,/prefers-reduced-motion:reduce/,/type="checkbox"/])assert.match(route,pattern);

console.log("✓ Full App Builder Production closure stays authenticated and exact-main Production only");
console.log("✓ 18 ordered stages now write a durable server evidence ledger without exposing service-role credentials to the browser");
console.log("✓ Evidence auth and privileged persistence stay behind provider-opaque LANERIQ Cloud adapter boundaries");
console.log("✓ Critical Generate/Version/Database/Workflow/Publish/Private stages are independently rechecked from persisted server data");
console.log("✓ Browser-only 18-page and anonymous HTTP health evidence stays explicitly separated from server DB facts");
console.log("✓ Final PASS requires stage 18, a private test project, truth-boundary flags and a SHA-256 report digest");
console.log("✓ Evidence ledger is RLS-protected, explicitly denied to anon/authenticated roles and granted only to service_role");
