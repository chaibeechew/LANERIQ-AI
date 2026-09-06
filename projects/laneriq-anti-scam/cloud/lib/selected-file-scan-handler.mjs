import crypto from 'node:crypto';
import { scanWithSharedMalwareDefense } from './malware-defense-broker.mjs';

const MAX_CONSENT_AGE_MS = 5 * 60 * 1000;

function normalizeHash(value) {
  const hash = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('INVALID_FILE_SHA256');
  return hash;
}

/**
 * Server-side L2 admission for a user-selected deep scan.
 * No raw file is accepted unless identity/attestation is verified and the user
 * consent is recent and bound to the exact SHA-256 being uploaded.
 */
export async function handleSelectedFileDeepScan({
  bytes,
  fileName,
  mimeType,
  sha256,
  consent,
  authToken,
  attestationToken,
  nowMs = Date.now(),
  authVerifier,
  attestationVerifier,
  scan = scanWithSharedMalwareDefense,
} = {}) {
  if (typeof authVerifier !== 'function') throw new Error('SCAN_AUTH_VERIFIER_NOT_CONFIGURED');
  if (typeof attestationVerifier !== 'function') throw new Error('SCAN_ATTESTATION_VERIFIER_NOT_CONFIGURED');

  const identity = await authVerifier(authToken, { nowMs });
  if (!identity?.ok || !identity.userId) throw new Error('SCAN_AUTH_REJECTED');
  const attestation = await attestationVerifier(attestationToken, { nowMs });
  if (!attestation?.ok || attestation.packageName !== 'ai.laneriq.antiscam' || attestation.appIntegrityVerified !== true) {
    throw new Error('SCAN_APP_ATTESTATION_REJECTED');
  }

  const claimedHash = normalizeHash(sha256);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (actualHash !== claimedHash) throw new Error('SCAN_HASH_MISMATCH');

  if (!consent || consent.purpose !== 'DEEP_MALWARE_SCAN' || consent.fileSha256 !== claimedHash) {
    throw new Error('SCAN_CONSENT_NOT_HASH_BOUND');
  }
  const consentAtMs = Number(consent.consentAtMs || 0);
  if (!Number.isFinite(consentAtMs) || consentAtMs <= 0 || consentAtMs > nowMs + 60_000 || nowMs - consentAtMs > MAX_CONSENT_AGE_MS) {
    throw new Error('SCAN_CONSENT_STALE_OR_INVALID');
  }

  const result = await scan({
    bytes: buffer,
    fileName,
    mimeType,
    sha256: claimedHash,
    userAuthorizedSampleUpload: true,
    scope: {
      tenantId: 'laneriq-anti-scam',
      userId: String(identity.userId).slice(0, 120),
      projectId: 'laneriq-anti-scam',
    },
  });

  return Object.freeze({
    ok: true,
    sha256: claimedHash,
    normalizedVerdict: result.normalizedVerdict,
    reason: result.reason,
    signedEvidence: result.signedEvidence,
    rawFileRetainedByAntiScamBroker: false,
  });
}
