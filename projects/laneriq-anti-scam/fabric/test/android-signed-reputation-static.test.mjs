import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mainRoot = path.join(
  process.cwd(),
  'projects/laneriq-anti-scam/android/app/src/main/java/ai/laneriq/antiscam',
);

function javaFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.java'))
    .map((name) => path.join(dir, name));
}

test('production Android call sites cannot use the test-only threat-feed verifier', () => {
  const offenders = [];
  for (const file of javaFiles(mainRoot)) {
    if (path.basename(file) === 'SignedThreatReputationEvidence.java') continue;
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes('verifierForTests(')) offenders.push(path.basename(file));
  }
  assert.deepEqual(offenders, []);
});

test('production trust root is fail-closed until an approved feed key is deliberately pinned', () => {
  const source = fs.readFileSync(path.join(mainRoot, 'TrustedThreatFeedKeys.java'), 'utf8');
  assert.match(source, /Collections\.emptyMap\(\)/);
});

test('strong cache lookup re-verifies the signed evidence envelope', () => {
  const source = fs.readFileSync(path.join(mainRoot, 'LocalThreatReputationStore.java'), 'utf8');
  assert.match(source, /reverifySignedEnvelope/);
  assert.match(source, /productionVerifier\(\)\.verify/);
  assert.match(source, /signed-cache-reverification-failed/);
});
