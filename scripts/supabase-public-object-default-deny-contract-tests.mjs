import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const migration=read("supabase/migrations/20260906081500_public_object_default_privileges_fail_closed.sql");
const policy=JSON.parse(read("config/supabase-public-object-privilege-policy.json"));
const closure=JSON.parse(read("config/production-release-closure-policy.json"));

for(const owner of ["postgres","supabase_admin"]){
  for(const objectType of ["tables","sequences"]){
    for(const role of ["public","anon","authenticated","service_role"]){
      assert.match(
        migration,
        new RegExp(`alter default privileges for role ${owner} in schema public revoke all on ${objectType} from ${role}`),
        `Missing default deny: ${owner} ${objectType} -> ${role}`,
      );
    }
  }
}

assert.deepEqual(policy.creatorRoles,["postgres","supabase_admin"]);
assert.equal(policy.defaultObjectPolicy.functions,"explicit-grant-only");
assert.equal(policy.defaultObjectPolicy.tables,"explicit-grant-only");
assert.equal(policy.defaultObjectPolicy.sequences,"explicit-grant-only");
assert.deepEqual(policy.implicitApiRolesDenied,["public","anon","authenticated","service_role"]);
assert.equal(policy.liveAuditBasis.productionMutationPerformedByThisBranch,false);

assert.doesNotMatch(migration,/revoke\s+.+\s+on\s+(?:table|sequence)\s+public\./i,"Migration must not mutate existing object ACLs");
assert.doesNotMatch(migration,/alter\s+table\s+public\./i,"Default-deny migration must not alter existing tables");
assert.doesNotMatch(migration,/drop\s+(?:table|sequence|function)/i,"Default-deny migration must be additive governance only");

const domain=closure.conditionalDomains.find(item=>item.id==="supabase-public-object-default-deny");
assert.ok(domain,"Closure policy must track public-object default-deny governance");
assert.equal(domain.workflowFile,"supabase-public-object-default-deny.yml");
assert.equal(domain.name,"LANERIQ Supabase Public Object Default-Deny Gate");

console.log("✓ Future public tables and sequences default-deny API/service-role access for postgres and supabase_admin creators");
console.log("✓ Existing object ACLs and tables are untouched by this migration");
console.log("✓ Functions, tables and sequences are governed by explicit-grant-only policy");
console.log("✓ Production Release Closure conditionally tracks this Supabase governance domain");
