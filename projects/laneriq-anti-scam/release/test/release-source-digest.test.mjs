import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computeReleaseSourceDigest } from '../release-source-digest.mjs';

const workflows = [
  'laneriq-anti-scam-p0-android.yml',
  'laneriq-anti-scam-production-aab.yml',
  'laneriq-anti-scam-cloud-deadman-deploy.yml',
  'laneriq-anti-scam-final-store-release-gate.yml',
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'laneriq-release-digest-'));
  const project = path.join(root, 'projects/laneriq-anti-scam');
  for (const dir of ['android', 'cloud', 'fabric', 'release']) fs.mkdirSync(path.join(project, dir), { recursive: true });
  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(project, 'android/app.txt'), 'android-v1\n');
  fs.writeFileSync(path.join(project, 'cloud/cloud.txt'), 'cloud-v1\n');
  fs.writeFileSync(path.join(project, 'fabric/fabric.txt'), 'fabric-v1\n');
  fs.writeFileSync(path.join(project, 'release/policy.txt'), 'policy-v1\n');
  fs.writeFileSync(path.join(project, 'release/PUBLIC_RELEASE_EVIDENCE.json'), '{"tokens":[]}\n');
  fs.mkdirSync(path.join(project, 'release/evidence'), { recursive: true });
  fs.writeFileSync(path.join(project, 'release/evidence/run.json'), '{"generated":true}\n');
  for (const name of workflows) fs.writeFileSync(path.join(root, '.github/workflows', name), `name: ${name}\n`);
  return root;
}

test('L5 release source digest is deterministic and ignores evidence bundle/generated evidence', () => {
  const root = fixture();
  try {
    const first = computeReleaseSourceDigest({ root });
    const second = computeReleaseSourceDigest({ root });
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.fileCount, second.fileCount);

    fs.writeFileSync(path.join(root, 'projects/laneriq-anti-scam/release/PUBLIC_RELEASE_EVIDENCE.json'), '{"tokens":[{"x":1}]}\n');
    fs.writeFileSync(path.join(root, 'projects/laneriq-anti-scam/release/evidence/run.json'), '{"generated":false}\n');
    const afterEvidence = computeReleaseSourceDigest({ root });
    assert.equal(afterEvidence.sha256, first.sha256);

    fs.writeFileSync(path.join(root, 'projects/laneriq-anti-scam/cloud/cloud.txt'), 'cloud-v2\n');
    const afterSource = computeReleaseSourceDigest({ root });
    assert.notEqual(afterSource.sha256, first.sha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('L5 release source digest changes when release governance workflow changes', () => {
  const root = fixture();
  try {
    const first = computeReleaseSourceDigest({ root });
    fs.appendFileSync(path.join(root, '.github/workflows/laneriq-anti-scam-final-store-release-gate.yml'), 'changed: true\n');
    const second = computeReleaseSourceDigest({ root });
    assert.notEqual(second.sha256, first.sha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
