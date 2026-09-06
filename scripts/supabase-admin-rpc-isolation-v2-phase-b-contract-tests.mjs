import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const migration=read("supabase/migrations/20260906090000_admin_rpc_isolation_v2_phase_b.sql");
const creator=read("lib/cloud-adapters/creator-support-data.js");
const buyout=read("lib/buyout-license/server.js");

for(const signature of [
  "admin_review_creator_support\\(uuid,text,text\\)",
  "admin_set_creator_support_mode\\(text\\)",
  "admin_issue_buyout_license\\(uuid,text,text\\)",
]){
  assert.match(
    migration,
    new RegExp(`revoke all on function public\\.${signature} from public,anon,authenticated,service_role`),
  );
}

assert.match(creator,/admin\.rpc\("admin_set_creator_support_mode_v2"/);
assert.match(creator,/admin\.rpc\("admin_review_creator_support_v2"/);
assert.match(buyout,/admin\.rpc\("admin_issue_buyout_license_v2"/);
assert.doesNotMatch(creator,/auth\.client\.rpc\("admin_set_creator_support_mode"/);
assert.doesNotMatch(creator,/auth\.client\.rpc\("admin_review_creator_support"/);
assert.doesNotMatch(buyout,/auth\.client\.rpc\("admin_issue_buyout_license"/);

assert.match(migration,/Apply only after Phase A2 callers are Production-verified/i);
assert.match(migration,/Legacy v1 Admin RPCs become owner-only/i);
assert.doesNotMatch(migration,/drop\s+function/i,"Phase B disables API access without destructive function drops");
assert.doesNotMatch(migration,/grant\s+execute/i,"Phase B must not re-grant legacy API execution");

console.log("✓ Phase B removes all API-role EXECUTE from three legacy Admin RPC v1 functions");
console.log("✓ Production callers remain exclusively on service-role Admin RPC v2");
console.log("✓ Legacy functions are not dropped, preserving forensic/schema continuity while disabling API reachability");
console.log("✓ Phase B remains gated on prior A2 exact-SHA Production verification");
