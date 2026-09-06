import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaunchReport } from '../launch-report.mjs';

test('launch report keeps public production blocked without trusted external evidence and exposes source digest', () => {
  const report = buildLaunchReport({ root: process.cwd(), evidence: {} });
  assert.equal(report.staticStorePackage, 'READY');
  assert.equal(report.publicProduction, 'BLOCKED');
  assert.equal(report.trustedReleaseEvidenceKeyCount, 0);
  assert.match(report.releaseSourceDigestSha256, /^[0-9a-f]{64}$/);
  assert.ok(report.releaseSourceFileCount > 0);
  assert.deepEqual(report.blockedLayers, [
    'L1_REALTIME_INTERCEPTION',
    'L2_MALWARE_EFFICACY',
    'L3_GUARDIAN_REAL_DEVICE',
    'L4_PRODUCTION_TRUST_CLOUD',
    'L5_PRODUCTION_SCALE_STORE',
  ]);
});
