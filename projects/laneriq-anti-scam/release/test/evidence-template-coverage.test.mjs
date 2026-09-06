import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ReleaseGateId } from '../release-readiness.mjs';

test('external evidence template covers every ReleaseGateId exactly once and requires source digest binding', () => {
  const template = JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'projects/laneriq-anti-scam/release/EXTERNAL_RELEASE_EVIDENCE_TEMPLATE.json'),
    'utf8',
  ));
  const expected = Object.values(ReleaseGateId).sort();
  const actual = Object.values(template.gates).flat().sort();
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length);
  assert.equal(template.schema, 2);
  assert.equal(typeof template.sourceDigestCommand, 'string');
  assert.match(template.tokenTemplate.releaseSourceDigestSha256, /64_HEX_RELEASE_SOURCE_DIGEST/);
});
