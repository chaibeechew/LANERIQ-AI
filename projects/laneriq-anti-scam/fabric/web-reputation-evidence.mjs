import { verify } from 'node:crypto';

const VERIFIED_WEB_EVIDENCE = Symbol('LANERIQ_VERIFIED_WEB_REPUTATION');
const SOURCE_TYPES = new Set(['trusted_reputation', 'phishing_feed', 'campaign_intelligence']);
const SHA256 = /^[0-9a-f]{64}$/i;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

export function canonicalWebEvidence(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('web evidence payload must be an object');
  }
  return JSON.stringify(canonicalize(payload));
}

export function verifySignedWebEvidence({
  payload,
  publicKeyPem,
  signatureBase64,
  nowMs = Date.now(),
  maxFutureSkewMs = 5 * 60_000,
} = {}) {
  const fail = (reason) => Object.freeze({ verified: false, reason });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('invalid_payload');
  if (typeof publicKeyPem !== 'string' || publicKeyPem.trim() === '') return fail('missing_public_key');
  if (typeof signatureBase64 !== 'string' || signatureBase64.trim() === '') return fail('missing_signature');

  const evidenceId = typeof payload.evidenceId === 'string' ? payload.evidenceId.trim() : '';
  const sourceType = typeof payload.sourceType === 'string' ? payload.sourceType.trim() : '';
  const domainHash = typeof payload.domainHash === 'string' ? payload.domainHash.trim().toLowerCase() : '';
  const verdict = typeof payload.verdict === 'string' ? payload.verdict.trim() : '';
  const issuedAtMs = Number(payload.issuedAtMs);
  const expiresAtMs = Number(payload.expiresAtMs);

  if (!evidenceId) return fail('missing_evidence_id');
  if (!SOURCE_TYPES.has(sourceType)) return fail('untrusted_source_type');
  if (!SHA256.test(domainHash)) return fail('invalid_domain_hash');
  if (!['MALICIOUS', 'HIGH_RISK'].includes(verdict)) return fail('unsupported_verdict');
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) return fail('invalid_time_bounds');
  if (issuedAtMs > nowMs + maxFutureSkewMs) return fail('evidence_from_future');
  if (expiresAtMs <= nowMs || expiresAtMs <= issuedAtMs) return fail('expired_evidence');

  try {
    const message = Buffer.from(canonicalWebEvidence(payload), 'utf8');
    const signature = Buffer.from(signatureBase64, 'base64');
    if (signature.length === 0 || !verify(null, message, publicKeyPem, signature)) return fail('signature_invalid');
  } catch {
    return fail('signature_invalid');
  }

  return Object.freeze({
    [VERIFIED_WEB_EVIDENCE]: true,
    verified: true,
    evidenceId,
    sourceType,
    domainHash,
    verdict,
    expiresAtMs,
  });
}

export function isVerifiedWebEvidence(value) {
  return Boolean(value && value[VERIFIED_WEB_EVIDENCE] === true && value.verified === true);
}
