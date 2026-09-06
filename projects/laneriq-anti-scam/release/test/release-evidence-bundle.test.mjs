import test from 'node:test';
import assert from 'node:assert/strict';
import { ReleaseGateId } from '../release-readiness.mjs';
import {
  loadVerifiedReleaseEvidenceBundle,
  releaseEvidenceFieldCoverage,
} from '../release-evidence-bundle.mjs';

test('release evidence bundle maps every public gate to one readiness field', () => {
  const mappedGateIds = Object.keys(releaseEvidenceFieldCoverage()).sort();
  assert.deepEqual(mappedGateIds, Object.values(ReleaseGateId).sort());
});

test('default public evidence bundle fails closed with no implicit PASS tokens and binds current source digest', () => {
  const bundle = loadVerifiedReleaseEvidenceBundle({ nowMs: Date.now(), root: process.cwd() });
  assert.equal(bundle.totalTokens, 0);
  assert.deepEqual(bundle.verifiedGateIds, []);
  assert.deepEqual(bundle.rejectedGateIds, []);
  assert.deepEqual(bundle.evidence, {});
  assert.match(bundle.releaseSourceDigestSha256, /^[0-9a-f]{64}$/);
  assert.ok(bundle.releaseSourceFileCount > 0);
});
