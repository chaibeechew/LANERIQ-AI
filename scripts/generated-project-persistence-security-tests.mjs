import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const generate=read("app/api/generate/route.js");
const builderDomain=read("lib/cloud/builder-projects.js");
const builderAdapter=read("lib/cloud-adapters/builder-project-data.js");
const migration=read("supabase/migrations/20260903122000_restrict_generated_project_persistence_service_role.sql");
const signature="server_persist_generated_project\\(uuid,text,text,text,text,jsonb,text\\)";

// Route layer must be provider opaque. It authenticates through the LANERIQ Cloud domain and never receives an admin client.
assert.match(generate,/lib\/cloud\/builder-projects\.js/,"Generate must cross the LANERIQ Cloud Builder Project boundary.");
assert.match(generate,/getBuilderPrincipal\(\{requireVerified:true\}\)/,"Generate must require a verified Cloud principal before generation.");
assert.match(generate,/persistBuilderGeneratedProject\(/,"Generate must persist only through the Cloud domain.");
assert.doesNotMatch(generate,/lib\/supabase\/|@supabase\//,"Generate route must not directly import the current provider.");
assert.doesNotMatch(generate,/createAdminClient|SERVICE_ROLE|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/,"Generate route must never hold provider admin credentials.");
assert.ok(generate.indexOf("getBuilderPrincipal({requireVerified:true})")<generate.indexOf("persistBuilderGeneratedProject("),"Verified principal resolution must happen before Cloud persistence.");
const finalVerifyIndex=generate.indexOf("const verified=verifyGeneration(generationResult),finalReview=runCriticChecks(generationResult,adultRequirements)");
const persistenceIndex=generate.indexOf("const persistence=await persistBuilderGeneratedProject",finalVerifyIndex);
assert.ok(finalVerifyIndex>=0&&persistenceIndex>finalVerifyIndex,"Final generation + critic verification must complete after any bounded rescue and before generated-project persistence.");
assert.ok(generate.indexOf("if(!verified.passed||!finalReview.passed)",finalVerifyIndex)<persistenceIndex,"Failed final verification must remain fail-closed before persistence.");
assert.match(generate,/for\(let attempt=1;attempt<=QUALITY_GATE_RESCUE_ATTEMPTS;attempt\+=1\)/,"Any post-Adult rescue must remain explicitly bounded.");
assert.match(generate,/if\(review\.passed&&report\.passed\)/,"A rescue candidate must pass both critic and deterministic generation verification.");

// Provider/domain split: the domain stays provider opaque; only the compatibility adapter can touch current provider clients.
assert.match(builderDomain,/cloud-adapters\/builder-project-data\.js/);
assert.match(builderDomain,/persistGeneratedProject/);
assert.doesNotMatch(builderDomain,/lib\/supabase\/|@supabase\/|createAdminClient/,"Builder domain must not depend directly on provider SDK/admin clients.");
assert.match(builderAdapter,/\.\.\/supabase\/server\.js/);
assert.match(builderAdapter,/\.\.\/supabase\/admin\.js/);
assert.match(builderAdapter,/auth\.getUser\(\)/,"Compatibility adapter must independently validate server identity.");
assert.match(builderAdapter,/resolvePrincipal\(client, \{ requireVerified: true \}\)/,"Privileged generated-project persistence must require a verified principal inside the adapter too.");
assert.match(builderAdapter,/const admin = createAdminClient\(\)/,"Service-role escalation must be explicitly scoped inside the compatibility adapter.");
assert.match(builderAdapter,/admin\.rpc\("server_persist_generated_project"/,"Atomic generated-project persistence must execute only behind the service-role adapter boundary.");
assert.doesNotMatch(builderAdapter,/client\.rpc\("server_persist_generated_project"/,"The customer-scoped provider client must never invoke the privileged persistence RPC.");
const persistBlock=builderAdapter.slice(builderAdapter.indexOf("async persistGeneratedProject"),builderAdapter.indexOf("async saveGeneratedProjectContext"));
assert.ok(persistBlock.indexOf("resolvePrincipal")<persistBlock.indexOf("createAdminClient()"),"Adapter authentication must happen before service-role escalation.");

// Database is the final authority and remains service-role only.
assert.match(migration,/security definer/i);
assert.match(migration,/set search_path=''/i);
assert.match(migration,/coalesce\(auth\.role\(\),''\) <> 'service_role'/i,"RPC must reject non-service JWT roles even if a future grant is accidentally broadened.");
assert.match(migration,new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`,"i"));
assert.match(migration,new RegExp(`grant execute on function public\\.${signature} to service_role`,"i"));
assert.doesNotMatch(migration,new RegExp(`grant execute on function public\\.${signature} to (?:public|anon|authenticated)`,"i"));
assert.match(migration,/owner_id=uid and generation_request_id=request_key/,"Atomic replay must remain owner + stable-request bound.");
assert.match(migration,/pg_advisory_xact_lock/,"Concurrent same-request persistence must remain serialized.");
assert.match(migration,/insert into public\.app_versions/,"The privileged RPC must still atomically create the initial version.");
assert.match(migration,/update public\.apps set current_version_id=version_row\.id/,"The initial version pointer must still advance atomically.");

console.log("✓ Generated App + Website route is provider-opaque and persists only through LANERIQ Cloud");
console.log("✓ Bounded quality rescue can only cross persistence after the same final generation + critic gates pass");
console.log("✓ Cloud adapter re-authenticates before service-role escalation; the user-scoped client cannot call privileged persistence");
console.log("✓ Final AI verification completes before Cloud persistence and database RPC remains service-role only");
console.log("✓ Atomic replay, version creation and current-version pointer semantics remain intact");