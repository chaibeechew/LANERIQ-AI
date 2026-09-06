import assert from "node:assert/strict";
import fs from "node:fs";
import {buildStoreReadiness} from "../lib/publishing/store-readiness-policy.js";
import { buildComputeConsentReceipt, computeStoreCompliance, evaluateComputePrivacyAdmission } from "../lib/device-compute/store-compliance.js";

const route=fs.readFileSync("app/api/publish/request/route.js","utf8");
const domain=fs.readFileSync("lib/cloud/builder-projects.js","utf8");
const adapter=fs.readFileSync("lib/cloud-adapters/builder-project-data.js","utf8");
const page=fs.readFileSync("app/publish/[id]/page.js","utf8");
const migration=fs.readFileSync("supabase/migrations/20260901135653_harden_store_publish_request_contract.sql","utf8");
const computePolicyRoute=fs.readFileSync("app/api/device-compute/policy/route.js","utf8");

const readiness=buildStoreReadiness({specification:{pages:[{name:"Home",route:"/"}]},listing:null,assets:[],inferredAnswers:{}});
assert.equal(readiness.readyForOfficialSubmission,false);

// Mother AI mobile compute must remain directly tied to user-facing LANERIQ functionality.
const appStoreCompute=computeStoreCompliance({nativePlatform:"ios",distributionChannel:"app_store",userInitiatedTask:true,visibility:"visible",thermalState:"nominal"});
assert.equal(appStoreCompute.personalComputeAllowed,true);
assert.equal(appStoreCompute.communityComputePreferenceOffered,false,"App Store mobile builds must not offer Community Compute.");
assert.equal(appStoreCompute.communityComputeExecutionAllowed,false,"App Store mobile builds must never execute community workloads.");
assert.equal(appStoreCompute.unrelatedBackgroundComputeAllowed,false);
assert.equal(appStoreCompute.bypassSystemPowerManagementAllowed,false);
assert.equal(appStoreCompute.downloadedExecutableWorkloadsAllowed,false);
assert.equal(appStoreCompute.prominentDisclosureRequired,true);
assert.equal(appStoreCompute.affirmativeConsentRequired,true);
assert.equal(appStoreCompute.privateContentPermissionImpliedByComputeConsent,false);

const iosBackground=computeStoreCompliance({nativePlatform:"ios",distributionChannel:"app_store",userInitiatedTask:true,visibility:"hidden",thermalState:"nominal",systemScheduledBackgroundTask:true});
assert.equal(iosBackground.backgroundPersonalComputeAllowed,true,"Eligible iOS background work must be system-scheduled and user-purpose-bound.");
const iosBackgroundHot=computeStoreCompliance({nativePlatform:"ios",distributionChannel:"app_store",userInitiatedTask:true,visibility:"hidden",thermalState:"fair",systemScheduledBackgroundTask:true});
assert.equal(iosBackgroundHot.backgroundPersonalComputeAllowed,false,"Optional iOS background compute must defer once thermal state is elevated.");
const consent=buildComputeConsentReceipt({purpose:"personal_compute",platformClass:"ios",distributionChannel:"app_store",mode:"balanced",maxResourceShare:0.05,timestamp:"2026-09-05T00:00:00.000Z"});
assert.equal(consent.privateContentPermissionGranted,false);
assert.equal(consent.maxResourceShare,0.05);
assert.equal(consent.affirmativeAction,true);

// Privacy-by-design admission: no hidden consent, no sensitive Community workloads, no cross-border shortcut.
assert.equal(evaluateComputePrivacyAdmission({purpose:"personal_compute",privacyClass:"p2",explicitConsent:false}).allowed,false);
assert.equal(evaluateComputePrivacyAdmission({purpose:"personal_compute",privacyClass:"p2",explicitConsent:true,consentWithdrawn:true}).reason,"consent_withdrawn");
assert.equal(evaluateComputePrivacyAdmission({purpose:"community_compute",privacyClass:"red",explicitConsent:true,dpiaApproved:true}).reason,"sensitive_community_workload_blocked");
assert.equal(evaluateComputePrivacyAdmission({purpose:"community_compute",privacyClass:"p1",explicitConsent:true,dpiaApproved:false}).reason,"community_compute_dpia_required");
assert.equal(evaluateComputePrivacyAdmission({purpose:"community_compute",privacyClass:"p1",explicitConsent:true,dpiaApproved:true,crossBorderTransfer:true,crossBorderReviewed:false}).reason,"cross_border_review_required");
const privacyAdmitted=evaluateComputePrivacyAdmission({purpose:"community_compute",privacyClass:"p1",explicitConsent:true,dpiaApproved:true,crossBorderTransfer:true,crossBorderReviewed:true});
assert.equal(privacyAdmitted.allowed,true);
assert.equal(privacyAdmitted.dataMinimizationRequired,true);
assert.equal(privacyAdmitted.purposeLimitationRequired,true);
assert.equal(privacyAdmitted.retentionMinimizationRequired,true);
assert.equal(privacyAdmitted.dpoApplicabilityAssessmentRequired,true);

// Customer-facing store preparation stays provider-opaque and uses a verified LANERIQ Cloud principal.
for(const pattern of [/getBuilderPrincipal\(\{requireVerified:true\}\)/,/Account verification is required/,/MAX_REQUEST_BYTES/,/REQUEST_ID/,/platform/,/apple/,/loadBuilderPublishPreparation/,/current_version_id !== versionId/,/evaluateReleaseReadiness/,/customer_approved_at/,/listing\.version_id !== versionId/,/createBuilderStorePublishRequest/,/officialSubmissionConfirmed:false/,/Nothing has been submitted to Apple or Google yet/,/Cache-Control\":\"private, no-store/])assert.match(route,pattern);
assert.doesNotMatch(route,/lib\/supabase\/|@supabase\/|createAdminClient|server_create_store_publish_request/);
const publishInvocation='const created=await createBuilderStorePublishRequest';
assert.ok(route.indexOf(publishInvocation)>0,"Cloud publish persistence invocation must exist.");
assert.ok(route.indexOf("current_version_id !== versionId")<route.indexOf(publishInvocation),"Exact current version must be verified before store preparation persistence.");
assert.ok(route.indexOf("customer_approved_at")<route.indexOf(publishInvocation),"Customer approval must be verified before store preparation persistence.");
assert.ok(route.indexOf("evaluateAuthoritativeStoreReadiness")<route.indexOf(publishInvocation),"Authoritative Store Readiness must be evaluated before store preparation persistence.");

// LANERIQ Cloud re-authenticates and owner-scopes the exact project/version/listing/assets before any service-role RPC.
assert.match(domain,/loadBuilderPublishPreparation/);assert.match(domain,/createBuilderStorePublishRequest/);
const loadBlock=adapter.slice(adapter.indexOf('async loadPublishPreparation'),adapter.indexOf('async createStorePublishRequest'));
const createBlock=adapter.slice(adapter.indexOf('async createStorePublishRequest'),adapter.indexOf('async saveStoreListing'));
assert.match(loadBlock,/resolvePrincipal\(client, \{ requireVerified: true \}\)/);
assert.match(loadBlock,/\.eq\("id", appId\)\.eq\("owner_id", userId\)/);
assert.match(loadBlock,/\.eq\("id", versionId\)\.eq\("app_id", appId\)/);
assert.match(loadBlock,/\.eq\("id", listingId\)\.eq\("app_id", appId\)/);
assert.match(loadBlock,/\.eq\("app_id", appId\)\.eq\("owner_id", userId\)/);
assert.match(loadBlock,/\.eq\("user_id", userId\)\.in\("id", assetIds\)/);
assert.match(createBlock,/resolvePrincipal\(client, \{ requireVerified: true \}\)/);
assert.match(createBlock,/createAdminClient\(\)/);
assert.match(createBlock,/server_create_store_publish_request/);
assert.match(createBlock,/p_user_id: principal\.principal\.principalId/);
assert.ok(createBlock.indexOf('resolvePrincipal')<createBlock.indexOf('createAdminClient()'),"Cloud adapter must authenticate before privileged store persistence.");

for(const pattern of [/stableStoreRequestId/,/window\.sessionStorage/,/requestId/,/platform/,/Prepare Apple Submission/,/Nothing has been submitted to the store yet/,/LANERIQ AI does not collect/])assert.match(page,pattern);
assert.match(computePolicyRoute,/storeCompliance/);
assert.match(computePolicyRoute,/appleAppStore/);
assert.match(computePolicyRoute,/compliancePolicy/);

assert.match(migration,/add column if not exists source_request_id text/i);
assert.match(migration,/unique index if not exists publish_requests_user_source_request_unique/i);
assert.match(migration,/status not in \('submitted','published'\).*provider_reference/is);
assert.match(migration,/submitted_at is not null/i);
assert.match(migration,/status<>'published' or published_at is not null/i);
assert.match(migration,/pg_column_size\(metadata\)<=65536/i);
assert.match(migration,/pg_advisory_xact_lock/i);
assert.match(migration,/owner_id=uid/i);
assert.match(migration,/current_version_id is distinct from p_version_id/i);
assert.match(migration,/customer_approved_at is null/i);
assert.match(migration,/officialSubmissionConfirmed',false/i);
assert.match(migration,/revoke all on function public\.server_create_store_publish_request\(uuid,uuid,uuid,uuid,text,text\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.server_create_store_publish_request\(uuid,uuid,uuid,uuid,text,text\) to service_role/i);

console.log("✓ App Store Mother AI compute is personal-purpose-only, prominently disclosed, affirmatively consented, system-power-respecting and community-workload disabled");
console.log("✓ Privacy admission blocks withdrawn consent, sensitive Community workloads, unapproved DPIA paths and unreviewed cross-border routing");
console.log("Apple App Store code contract passed: provider-opaque exact-version customer-approved preparation is replay safe and service-only, while official Apple submission/review stays truthfully LIVE PENDING until provider evidence exists.");
