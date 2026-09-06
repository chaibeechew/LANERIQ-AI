import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260906084500_public_table_sequence_default_privileges_fail_closed.sql","utf8");

for(const objectType of ["tables","sequences"]){
  for(const role of ["public","anon","authenticated","service_role"]){
    assert.match(
      migration,
      new RegExp(`alter default privileges for role postgres in schema public\\s+revoke all on ${objectType} from ${role}`),
      `postgres ${objectType} defaults must fail closed for ${role}`,
    );
    assert.match(
      migration,
      new RegExp(`execute 'alter default privileges for role supabase_admin in schema public revoke all on ${objectType} from ${role}'`),
      `supabase_admin ${objectType} hardening must be present behind an authority guard`,
    );
  }
}

assert.match(migration,/current_user = 'supabase_admin'/);
assert.match(migration,/pg_has_role\(current_user,'supabase_admin','MEMBER'\)/);
assert.match(migration,/elevated supabase_admin authority is required/i);
assert.match(migration,/changes defaults only and does not revoke\s+-- privileges from any existing table or sequence/i);
assert.doesNotMatch(migration,/revoke\s+.+\s+on\s+table\s+public\./i,"Existing tables must not be revoked by this migration");
assert.doesNotMatch(migration,/revoke\s+.+\s+on\s+sequence\s+public\./i,"Existing sequences must not be revoked by this migration");

console.log("✓ Future postgres-owned public tables and sequences are explicit-grant-only");
console.log("✓ Existing public tables/sequences are not mutated by this default-ACL migration");
console.log("✓ supabase_admin owner defaults are guarded behind real elevated-role authority");
