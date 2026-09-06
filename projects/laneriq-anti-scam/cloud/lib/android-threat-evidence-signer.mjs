import crypto from 'node:crypto';

const MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safeToken(value) {
  return String(value || '').trim().replace(/[\n\r=]/g, '_');
}

export function canonicalAndroidThreatEvidence(payload = {}) {
  return `schema=${Number(payload.schema || 1)}\n`
    + `evidence_id=${safeToken(payload.evidenceId)}\n`
    + `source_id=${safeToken(payload.sourceId)}\n`
    + `source_version=${safeToken(payload.sourceVersion)}\n`
    + `indicator_type=${safeToken(payload.indicatorType)}\n`
    + `indicator_hash=${String(payload.indicatorHash || '').trim().toLowerCase()}\n`
    + `verdict=${safeToken(payload.verdict || 'UNKNOWN')}\n`
    + `issued_at_ms=${Number(payload.issuedAtMs || 0)}\n`
    + `expires_at_ms=${Number(payload.expiresAtMs || 0)}\n`;
}

export function signAndroidThreatEvidence({
  indicatorType,
  indicatorHash,
  verdict,
  evidenceId,
  sourceId = 'laneriq-malware-defense',
  sourceVersion = 'mdc1',
  ttlMs = 24 * 60 * 60 * 1000,
  nowMs = Date.now(),
  privateKeyPem = process.env.LANERIQ_ANTI_SCAM_THREAT_SIGNING_KEY_PEM,
} = {}) {
  const hash = String(indicatorHash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('INVALID_INDICATOR_HASH');
  if (!['DOMAIN_SHA256', 'FILE_SHA256'].includes(indicatorType)) throw new Error('INVALID_INDICATOR_TYPE');
  if (!['KNOWN_MALICIOUS', 'HIGH_RISK', 'KNOWN_BENIGN'].includes(verdict)) throw new Error('INVALID_THREAT_VERDICT');
  if (!privateKeyPem || String(privateKeyPem).trim().length < 80) throw new Error('THREAT_SIGNING_KEY_NOT_CONFIGURED');

  const boundedTtl = Math.min(MAX_TTL_MS, Math.max(60_000, Number(ttlMs || 0)));
  const payload = Object.freeze({
    schema: 1,
    evidenceId: safeToken(evidenceId || `ev-${crypto.randomUUID()}`),
    sourceId: safeToken(sourceId),
    sourceVersion: safeToken(sourceVersion),
    indicatorType,
    indicatorHash: hash,
    verdict,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + boundedTtl,
  });

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ec') throw new Error('THREAT_SIGNING_KEY_MUST_BE_EC');
  const signature = crypto.sign('sha256', Buffer.from(canonicalAndroidThreatEvidence(payload), 'utf8'), privateKey);
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyX509Base64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

  return Object.freeze({
    payload,
    signatureBase64: signature.toString('base64'),
    publicKeyX509Base64,
  });
}
