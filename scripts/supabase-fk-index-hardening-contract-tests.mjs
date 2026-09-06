import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260906074500_cover_creator_support_fk_indexes.sql","utf8");
const expected=[
  ["app_licenses_issued_by_idx","public.app_licenses","issued_by"],
  ["creator_support_audit_actor_user_id_idx","public.creator_support_audit","actor_user_id"],
  ["creator_support_audit_request_id_idx","public.creator_support_audit","request_id"],
  ["creator_support_codes_issued_by_idx","public.creator_support_codes","issued_by"],
  ["creator_support_codes_revoked_by_idx","public.creator_support_codes","revoked_by"],
  ["creator_support_requests_decided_by_idx","public.creator_support_requests","decided_by"],
  ["creator_support_requests_unfinished_project_id_idx","public.creator_support_requests","unfinished_project_id"],
  ["creator_support_settings_updated_by_idx","public.creator_support_settings","updated_by"],
];
for(const [name,table,column] of expected){
  assert.match(migration,new RegExp(`create index if not exists ${name}\\s+on ${table.replace('.', '\\.') }\\(${column}\\)`,'i'));
}
assert.equal((migration.match(/create index if not exists/gi)||[]).length,expected.length);
assert.doesNotMatch(migration,/drop\s+index|drop\s+table|alter\s+table|delete\s+from|update\s+/i);
console.log("✓ Eight LIVE Advisor foreign-key gaps receive additive covering indexes");
console.log("✓ Migration contains no drops, table mutations, data updates or constraint changes");
