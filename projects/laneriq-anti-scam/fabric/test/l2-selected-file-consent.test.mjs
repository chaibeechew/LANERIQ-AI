import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { handleSelectedFileDeepScan } from '../../cloud/lib/selected-file-scan-handler.mjs';

const NOW = 1_800_000_000_000;
const bytes = Buffer.from('benign-test-fixture');
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
const authVerifier = async () => ({ ok: true, userId: 'user-1' });
const attestationVerifier = async () => ({ ok: true, packageName: 'ai.laneriq.antiscam', appIntegrityVerified: true });
const scan = async input => ({
  normalizedVerdict: 'HIGH_RISK',
  reason: 'test',
  signedEvidence: { payload: { indicatorHash: input.sha256 } },
});

function consent(overrides = {}) {
  return { purpose: 'DEEP_MALWARE_SCAN', fileSha256: hash, consentAtMs: NOW, ...overrides };
}

test('L2 accepts an authenticated, attested, recent exact-hash user-authorized deep scan', async () => {
  const result = await handleSelectedFileDeepScan({
    bytes,
    fileName: 'fixture.apk',
    sha256: hash,
    consent: consent(),
    nowMs: NOW,
    authVerifier,
    attestationVerifier,
    scan,
  });
  assert.equal(result.ok, true);
  assert.equal(result.sha256, hash);
  assert.equal(result.rawFileRetainedByAntiScamBroker, false);
});

test('L2 refuses raw sample upload without exact-hash consent', async () => {
  await assert.rejects(() => handleSelectedFileDeepScan({
    bytes,
    sha256: hash,
    consent: consent({ fileSha256: '0'.repeat(64) }),
    nowMs: NOW,
    authVerifier,
    attestationVerifier,
    scan,
  }), /SCAN_CONSENT_NOT_HASH_BOUND/);
});

test('L2 refuses stale consent and untrusted app attestation', async () => {
  await assert.rejects(() => handleSelectedFileDeepScan({
    bytes,
    sha256: hash,
    consent: consent({ consentAtMs: NOW - 10 * 60 * 1000 }),
    nowMs: NOW,
    authVerifier,
    attestationVerifier,
    scan,
  }), /SCAN_CONSENT_STALE_OR_INVALID/);

  await assert.rejects(() => handleSelectedFileDeepScan({
    bytes,
    sha256: hash,
    consent: consent(),
    nowMs: NOW,
    authVerifier,
    attestationVerifier: async () => ({ ok: true, packageName: 'evil.copy', appIntegrityVerified: true }),
    scan,
  }), /SCAN_APP_ATTESTATION_REJECTED/);
});
