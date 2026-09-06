import test from 'node:test';
import assert from 'node:assert/strict';
import { buildL1L5ExecutionStatus } from '../l1-l5-execution-status.mjs';

test('L1-L5 code surfaces can be present while Public Production remains evidence-blocked', () => {
  const status = buildL1L5ExecutionStatus({ root: process.cwd(), evidence: {} });
  assert.equal(status.allFiveLayerCodeSurfacesImplemented, true);
  assert.equal(status.publicProduction, 'BLOCKED');
  assert.equal(status.layers.length, 5);
  for (const layer of status.layers) {
    assert.equal(layer.codeImplemented, true);
    assert.equal(layer.externalEvidenceReady, false);
    assert.notEqual(layer.state, 'PRODUCTION_READY');
  }
});
