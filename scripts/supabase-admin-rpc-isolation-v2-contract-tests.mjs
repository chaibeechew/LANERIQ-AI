import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const migration=read("supabase/migrations/20260906072500_admin_rpc_isolation_v2_phase_a.sql");
const defaultsMigration=read("supabase/migrations/20260906074000_public_function_default_privileges_fail_closed.sql");
const portabilityMigration=read("supabase/migrations/20260904003000_creator_support_and_portability.sql");
const legalGateMigration=read("supabase/migrations/20260904003300_block_draft_migration_agreement_signing.sql");
const creator=read("lib/cloud-adapters/creator-support-data.js");
const buyout=read("lib/buyout-license/server.js");
const closurePolicy=JSON.parse(read("config/production-release-closure-policy.json"));
const definerPolicy=JSON.parse(read("config/supabase-security-definer-policy.json"));

const extractFunction=(source,name)=>{
  const marker=`create or replace function public.${name}(`;
  const start=source.indexOf(marker);
  assert.ok(start>=0,`Missing ${name}`);
  const tail=source.slice(start);
  const next=tail.slice(marker.length).search(/\ncreate or replace function public\./i);
  return next>=0?tail.slice(0,marker.length+next):tail;
};

const adminV2=[
  "admin_review_creator_support_v2",
  "admin_set_creator_support_mode_v2",
  "admin_issue_buyout_license_v2",
];
for(const fn of adminV2){
  assert.match(migration,new RegExp(`create or replace function public\\.${fn}\\(`));
}
assert.ok((migration.match(/security definer/g)||[]).length>=3);
assert.ok((migration.match(/set search_path = ''/g)||[]).length>=3);
assert.ok((migration.match(/raw_app_meta_data->>'role'/g)||[]).length>=3);
assert.ok((migration.match(/Admin access required/g)||[]).length>=3);
assert.match(migration,/p_admin_id uuid/);
assert.match(migration,/rpcVersion','v2-service-role/);

for(const signature of [
  "admin_review_creator_support_v2\\(uuid,uuid,text,text\\)",
  "admin_set_creator_support_mode_v2\\(uuid,text\\)",
  "admin_issue_buyout_license_v2\\(uuid,uuid,text,text\\)",
]){
  assert.match(migration,new RegExp(`revoke all on function public\\.${signature} from public,anon,authenticated`));
  assert.match(migration,new RegExp(`grant execute on function public\\.${signature} to service_role`));
}

// Phase A2: user session proves Admin identity, service-role transport performs privileged mutation,
// and the database independently revalidates p_admin_id. No silent fallback to legacy v1 is allowed.
assert.match(creator,/createAdminClient\(\)/);
assert.match(creator,/admin\.rpc\("admin_set_creator_support_mode_v2",\{p_admin_id:auth\.user\.id,p_mode:mode\}\)/);
assert.match(creator,/admin\.rpc\("admin_review_creator_support_v2",\{p_admin_id:auth\.user\.id,p_request_id:requestId/);
assert.match(buyout,/createAdminClient\(\)/);
assert.match(buyout,/admin\.rpc\("admin_issue_buyout_license_v2",\{p_admin_id:auth\.user\.id,p_app_id:appId/);
assert.doesNotMatch(creator,/auth\.client\.rpc\("admin_set_creator_support_mode"/);
assert.doesNotMatch(creator,/auth\.client\.rpc\("admin_review_creator_support"/);
assert.doesNotMatch(buyout,/auth\.client\.rpc\("admin_issue_buyout_license"/);
assert.doesNotMatch(creator,/catch[^\n]*admin_set_creator_support_mode|fallback[^\n]*admin_set_creator_support_mode/i);
assert.doesNotMatch(creator,/catch[^\n]*admin_review_creator_support|fallback[^\n]*admin_review_creator_support/i);
assert.doesNotMatch(buyout,/catch[^\n]*admin_issue_buyout_license|fallback[^\n]*admin_issue_buyout_license/i);

// Phase B is still separate: legacy authenticated grants remain until A2 is Production-verified.
assert.doesNotMatch(migration,/revoke all on function public\.admin_review_creator_support\(uuid,text,text\) from [^;]*authenticated/i);
assert.doesNotMatch(migration,/revoke all on function public\.admin_set_creator_support_mode\(text\) from [^;]*authenticated/i);
assert.doesNotMatch(migration,/revoke all on function public\.admin_issue_buyout_license\(uuid,text,text\) from [^;]*authenticated/i);
assert.match(migration,/legacy v1 retained temporarily for rollback/i);

// Future public-schema functions fail closed for both roles that can create functions in this Supabase project.
for(const owner of ["postgres","supabase_admin"]){
  for(const role of ["public","anon","authenticated","service_role"]){
    assert.match(defaultsMigration,new RegExp(`alter default privileges for role ${owner} in schema public\\s+revoke execute on functions from ${role}`));
  }
}
assert.match(defaultsMigration,/postgres or supabase_admin roles in public/i);
assert.match(defaultsMigration,/Every future Data API RPC must opt in with an explicit GRANT/i);

const expectedSelfService=[
  "get_creator_support_status",
  "get_project_migration_agreement",
  "redeem_creator_support_code",
  "request_creator_support",
].sort();
const declaredSelfService=definerPolicy.authenticatedSecurityDefinerAllowlist.map(item=>item.name).sort();
assert.deepEqual(declaredSelfService,expectedSelfService);
for(const item of definerPolicy.authenticatedSecurityDefinerAllowlist){
  assert.equal(item.callerSuppliedUserId,false,`${item.name} must not accept a caller-supplied user id`);
  const body=extractFunction(portabilityMigration,item.name);
  assert.match(body,/security definer/i);
  assert.match(body,/set search_path\s*=\s*''/i);
  assert.match(body,/auth\.uid\(\)/i);
  assert.doesNotMatch(body,/p_user_id/i);
}
assert.match(extractFunction(portabilityMigration,"get_creator_support_status"),/user_id=uid/i);
assert.match(extractFunction(portabilityMigration,"get_project_migration_agreement"),/owner_id=uid/i);
assert.match(extractFunction(portabilityMigration,"get_project_migration_agreement"),/user_id=uid/i);
assert.match(extractFunction(portabilityMigration,"redeem_creator_support_code"),/user_id=uid/i);
assert.match(extractFunction(portabilityMigration,"request_creator_support"),/owner_id=uid/i);

const disabled=definerPolicy.disabledSecurityDefiner.find(item=>item.name==="sign_project_migration_agreement");
assert.ok(disabled,"Draft migration signing must stay in the denylist");
assert.deepEqual(disabled.requiredApiRoles,[]);
assert.match(legalGateMigration,/revoke all on function public\.sign_project_migration_agreement\(uuid,text,boolean\)/);
assert.match(legalGateMigration,/from public, anon, authenticated, service_role/);
assert.doesNotMatch(legalGateMigration,/grant execute on function public\.sign_project_migration_agreement/);

assert.deepEqual(definerPolicy.privilegedAdminLegacyV1.sort(),[
  "admin_issue_buyout_license",
  "admin_review_creator_support",
  "admin_set_creator_support_mode",
].sort());
assert.deepEqual(definerPolicy.privilegedAdminV2.sort(),adminV2.sort());
assert.equal(definerPolicy.principles.futurePublicFunctionExecute,"explicit-grant-only");
assert.equal(definerPolicy.principles.adminMutationTransport,"service-role-only");

const domain=closurePolicy.conditionalDomains.find(item=>item.id==="supabase-admin-rpc-isolation");
assert.ok(domain,"Closure policy must track the Supabase Admin RPC isolation domain");
assert.equal(domain.workflowFile,"supabase-admin-rpc-isolation-v2.yml");
assert.equal(domain.name,"LANERIQ Supabase Admin RPC Isolation v2 Gate");
const leakedPassword=closurePolicy.globalProductionEvidence.find(item=>item.id==="supabase-auth-leaked-password-protection");
assert.ok(leakedPassword,"Global Production truth must track leaked-password protection");
assert.equal(leakedPassword.required,true);
assert.equal(leakedPassword.verifiedByThisGate,false);

console.log("✓ Phase A2 Admin mutations use service-role v2 RPC transport after user-session Admin proof");
console.log("✓ p_admin_id is bound to the verified session user and revalidated by each v2 database function");
console.log("✓ No silent fallback to legacy authenticated Admin RPC v1 remains in server callers");
console.log("✓ Phase B legacy grant revocation remains separate until A2 is Production-verified");
console.log("✓ Future postgres- and supabase_admin-created public functions remain explicit-grant-only");
console.log("✓ Reviewed auth.uid()-bound self-service allowlist and legal signing denylist remain intact");
console.log("✓ Leaked-password protection remains an unresolved Global Production security blocker");
