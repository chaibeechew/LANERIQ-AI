import assert from 'node:assert/strict';
import fs from 'node:fs';

const characterRoute=fs.readFileSync('app/api/avatar/character/route.js','utf8');
const continuityRoute=fs.readFileSync('app/api/avatar/continuity/route.js','utf8');
const domain=fs.readFileSync('lib/cloud/avatar-characters.js','utf8');
const adapter=fs.readFileSync('lib/cloud-adapters/avatar-character-data.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260905142500_living_character_persistence.sql','utf8');

for(const [name,source] of [['character',characterRoute],['continuity',continuityRoute]]){
  assert.match(source,/lib\/cloud\/avatar-characters\.js/,`${name} route must use provider-opaque Avatar Cloud domain`);
  assert.doesNotMatch(source,/lib\/supabase\/|@supabase\//,`${name} route must not directly import provider SDK`);
  assert.doesNotMatch(source,/createAdminClient|createClient.*supabase/,`${name} route must not own provider clients`);
  assert.match(source,/Cache-Control":"private, no-store/);
}
assert.match(domain,/cloud-adapters\/avatar-character-data\.js/);
assert.doesNotMatch(domain,/lib\/supabase\/|@supabase\//,'Avatar Cloud domain must remain provider opaque');
assert.match(domain,/version>=2&&version<=4/,'Avatar Cloud domain must accept current Living Character schema v4');
assert.match(domain,/Buffer\.byteLength\(JSON\.stringify\(manifest\)/);
assert.match(domain,/persistentMemoryIncluded===true/);
assert.match(domain,/rawAssetIncluded===true/);
assert.match(adapter,/\.\.\/supabase\/server\.js/);
assert.match(adapter,/\.\.\/supabase\/admin\.js/);
assert.match(adapter,/auth\.getUser\(\)/);
assert.match(adapter,/living_characters/);
assert.match(adapter,/living_character_devices/);
assert.match(adapter,/CHARACTER_REVISION_CONFLICT/);
assert.match(adapter,/upsert/);
assert.match(migration,/force row level security/i);
assert.match(migration,/revoke all on table public\.living_characters from public, anon, authenticated/i);
assert.match(migration,/revoke all on table public\.living_character_devices from public, anon, authenticated/i);
console.log('Avatar Cloud boundary passed: provider-opaque App routes accept Living Character v4 while authenticated owner-scoped persistence remains isolated behind the compatibility adapter.');

await import('./laneriq-knowledge-fabric-v2-contract-tests.mjs');
