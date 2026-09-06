import assert from "node:assert/strict";
import fs from "node:fs";
import { buildStoreReadiness } from "../lib/publishing/store-readiness-policy.js";
import { buildComputeConsentReceipt, computeStoreCompliance } from "../lib/device-compute/store-compliance.js";

const route=fs.readFileSync("app/api/publish/request/route.js","utf8");
const metadataRoute=fs.readFileSync("app/api/store-metadata/route.js","utf8");
const metadataSave=fs.readFileSync("app/api/store-metadata/save/route.js","utf8");
const domain=fs.readFileSync("lib/cloud/builder-projects.js","utf8");
const adapter=fs.readFileSync("lib/cloud-adapters/builder-project-data.js","utf8");
const page=fs.readFileSync("app/publish/[id]/page.js","utf8");
const migration=fs.readFileSync("supabase/migrations/20260901135653_harden_store_publish_request_contract.sql","utf8");
const computePolicyRoute=fs.readFileSync("app/api/device-compute/policy/route.js","utf8");

const readiness=buildStoreReadiness({specification:{pages:[{name:"Home",route:"/"}],features:["Login","Analytics"]},listing:null,assets:[],inferredAnswers:{}});
assert.equal(readiness.readyForOfficialSubmission,false);
assert.equal(readiness.checks.find(item=>item.key==="google_data_safety")?.status,"external_required");

// Google Play builds keep device compute tied to the user's own LANERIQ tasks and system power controls.
const playCompute=computeStoreCompliance({nativePlatform:"android",distributionChannel:"google_play",userInitiatedTask:true,visibility:"visible",thermalState:"nominal"});
assert.equal(playCompute.personalComputeAllowed,true);
assert.equal(playCompute.communityComputePreferenceOffered,false,"Google Play mobile builds must not offer Community Compute.");
assert.equal(playCompute.communityComputeExecutionAllowed,false,"Google Play mobile builds must never execute community workloads.");
assert.equal(playCompute.bypassSystemPowerManagementAllowed,false);
assert.equal(playCompute.downloadedExecutableWorkloadsAllowed,false);
assert.equal(playCompute.prominentDisclosureRequired,true);
assert.equal(playCompute.affirmativeConsentRequired,true);
assert.equal(playCompute.privateContentPermissionImpliedByComputeConsent,false);

const androidBackgroundDenied=computeStoreCompliance({nativePlatform:"android",distributionChannel:"google_play",userInitiatedTask:true,visibility:"hidden",thermalState:"nominal",systemManagedBackgroundWork:false});
assert.equal(androidBackgroundDenied.backgroundPersonalComputeAllowed,false,"Android background compute must not bypass system-managed work scheduling.");
const androidBackgroundAllowed=computeStoreCompliance({nativePlatform:"android",distributionChannel:"google_play",userInitiatedTask:true,visibility:"hidden",thermalState:"nominal",systemManagedBackgroundWork:true});
assert.equal(androidBackgroundAllowed.backgroundPersonalComputeAllowed,true);
const lowPower=computeStoreCompliance({nativePlatform:"android",distributionChannel:"google_play",userInitiatedTask:true,visibility:"visible",thermalState:"nominal",lowPowerMode:true});
assert.equal(lowPower.personalComputeAllowed,false,"Optional compute must stop in low-power mode.");
const consent=buildComputeConsentReceipt({purpose:"personal_compute",platformClass:"android",distributionChannel:"google_play",mode:"balanced",maxResourceShare:0.05,timestamp:"2026-09-05T00:00:00.000Z"});
assert.equal(consent.privateContentPermissionGranted,false);
assert.equal(consent.affirmativeAction,true);

for(const pattern of [/getBuilderPrincipal\(\{requireVerified:true\}\)/,/Account verification is required/,/MAX_REQUEST_BYTES/,/REQUEST_ID/,/"google_play"/,/loadBuilderPublishPreparation/,/current_version_id !== versionId/,/evaluateReleaseReadiness/,/customer_approved_at/,/listing\.version_id !== versionId/,/createBuilderStorePublishRequest/,/officialSubmissionConfirmed:false/,/Nothing has been submitted to Apple or Google yet/,/private, no-store/])assert.match(route,pattern);
assert.doesNotMatch(route,/lib\/supabase\/|@supabase\/|createAdminClient|server_create_store_publish_request/);
const publishInvocation='const created=await createBuilderStorePublishRequest';
assert.ok(route.indexOf(publishInvocation)>0);
assert.ok(route.indexOf("current_version_id !== versionId")<route.indexOf(publishInvocation));
assert.ok(route.indexOf("customer_approved_at")<route.indexOf(publishInvocation));
assert.ok(route.indexOf("evaluateAuthoritativeStoreReadiness")<route.indexOf(publishInvocation));

assert.match(domain,/loadBuilderPublishPreparation/);assert.match(domain,/createBuilderStorePublishRequest/);assert.match(domain,/saveBuilderStoreListing/);
const loadBlock=adapter.slice(adapter.indexOf('async loadPublishPreparation'),adapter.indexOf('async createStorePublishRequest'));
const createBlock=adapter.slice(adapter.indexOf('async createStorePublishRequest'),adapter.indexOf('async saveStoreListing'));
assert.match(loadBlock,/resolvePrincipal\(client, \{ requireVerified: true \}\)/);
assert.match(loadBlock,/\.eq\("id", appId\)\.eq\("owner_id", userId\)/);
assert.match(loadBlock,/\.eq\("id", versionId\)\.eq\("app_id", appId\)/);
assert.match(createBlock,/resolvePrincipal\(client, \{ requireVerified: true \}\)/);
assert.match(createBlock,/createAdminClient\(\)/);
assert.match(createBlock,/server_create_store_publish_request/);
assert.ok(createBlock.indexOf('resolvePrincipal')<createBlock.indexOf('createAdminClient()'));

assert.match(metadataRoute,/googlePlay/);
assert.match(metadataRoute,/dataSafety/);
assert.match(metadataSave,/googlePlay/);
assert.match(metadataSave,/saveBuilderStoreListing/);
assert.doesNotMatch(metadataSave,/createAdminClient|lib\/supabase\//);
assert.match(page,/google_play/);
assert.match(page,/Google Play/i);
assert.match(page,/stableStoreRequestId/);
assert.match(page,/requestId/);
assert.match(page,/Nothing has been submitted to the store yet/);
assert.match(computePolicyRoute,/storeCompliance/);
assert.match(computePolicyRoute,/googlePlay/);

assert.match(migration,/platform_name not in \('apple','google_play'\)/i);
assert.match(migration,/source_request_id/i);
assert.match(migration,/unique index if not exists publish_requests_user_source_request_unique/i);
assert.match(migration,/pg_advisory_xact_lock/i);
assert.match(migration,/current_version_id is distinct from p_version_id/i);
assert.match(migration,/customer_approved_at is null/i);
assert.match(migration,/officialSubmissionConfirmed',false/i);
assert.match(migration,/grant execute on function public\.server_create_store_publish_request\(uuid,uuid,uuid,uuid,text,text\) to service_role/i);

console.log("✓ Google Play Mother AI compute is personal-purpose-only, prominently disclosed, affirmatively consented, system-power-respecting and community-workload disabled");
console.log("✓ Google Play preparation is provider-opaque, exact-version, customer-approved, replay-safe and service-role only");
console.log("✓ Google Play metadata and Data Safety remain explicit external-review requirements instead of AI-auto-claimed answers");
console.log("✓ Official Play Console signing/submission/review stays truthfully LIVE PENDING until provider evidence exists");
