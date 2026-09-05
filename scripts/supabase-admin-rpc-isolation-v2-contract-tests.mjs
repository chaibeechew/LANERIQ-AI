import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const migration=read("supabase/migrations/20260906072500_admin_rpc_isolation_v2_phase_a.sql");
const creator=read("lib/cloud-adapters/creator-support-data.js");
const buyout=read("lib/buyout-license/server.js");
const policy=JSON.parse(read("config/production-release-closure-policy.json"));

for(const fn of [
  "admin_review_creator_support_v2",
  "admin_set_creator_support_mode_v2",
  "admin_issue_buyout_license_v2",
]){
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

// Phase A1 is intentionally additive. Existing callers stay on v1 until the v2 functions are LIVE-verified.
assert.match(creator,/auth\.client\.rpc\("admin_set_creator_support_mode"/);
assert.match(creator,/auth\.client\.rpc\("admin_review_creator_support"/);
assert.match(buyout,/auth\.client\.rpc\("admin_issue_buyout_license"/);
assert.doesNotMatch(migration,/revoke all on function public\.admin_review_creator_support\(uuid,text,text\) from [^;]*authenticated/i);
assert.doesNotMatch(migration,/revoke all on function public\.admin_set_creator_support_mode\(text\) from [^;]*authenticated/i);
assert.doesNotMatch(migration,/revoke all on function public\.admin_issue_buyout_license\(uuid,text,text\) from [^;]*authenticated/i);
assert.match(migration,/legacy v1 retained temporarily for rollback/i);

const domain=policy.conditionalDomains.find(item=>item.id==="supabase-admin-rpc-isolation");
assert.ok(domain,"Closure policy must track the Supabase Admin RPC isolation domain");
assert.equal(domain.workflowFile,"supabase-admin-rpc-isolation-v2.yml");
assert.equal(domain.name,"LANERIQ Supabase Admin RPC Isolation v2 Gate");

console.log("✓ Phase A1 adds three service-role-only SECURITY DEFINER Admin RPC v2 functions");
console.log("✓ Each v2 function re-validates the server-supplied Admin actor inside Postgres");
console.log("✓ anon/authenticated cannot execute v2; service_role is the only API execution role granted");
console.log("✓ Legacy v1 authenticated callers remain intact during additive LIVE verification");
console.log("✓ Production Release Closure Index conditionally requires this security domain when its paths change");
