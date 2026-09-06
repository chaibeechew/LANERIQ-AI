import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStaticStorePackage } from '../store-static-gate.mjs';

test('store package static gate is ready for external evidence collection', () => {
  const result = evaluateStaticStorePackage(process.cwd());
  assert.equal(result.readyForExternalEvidenceCollection, true, result.failures.join(','));
  assert.deepEqual(result.failures, []);
});
