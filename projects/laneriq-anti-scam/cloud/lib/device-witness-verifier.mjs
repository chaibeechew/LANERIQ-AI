import crypto from 'node:crypto';

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_OBSERVED_AGE_MS = 5 * 60 * 1000;

function safeToken(value) {
  const v = String(value ?? 'unknown').trim() || 'unknown';
  return v.replace(/[\n\r=]/g, '_');
}

export function canonicalGuardianWitness(payload = {}) {
  return `schema=1\n`
    + `package=${safeToken(payload.packageName)}\n`
    + `epoch=${Math.max(0, Number(payload.leaseEpoch || 0))}\n`
    + `sequence=${Math.max(0, Number(payload.heartbeatSequence || 0))}\n`
    + `expires=${Math.max(0, Number(payload.leaseExpiresAtMs || 0))}\n`
    + `integrity=${safeToken(payload.integrityState)}\n`
    + `emergency=${safeToken(payload.emergencyLevel)}\n`
    + `alerts=${safeToken(payload.alertDeliveryState)}\n`
    + `policy=${safeToken(payload.policyVersion)}\n`
    + `observed=${Math.max(0, Number(payload.observedAtMs || 0))}\n`;
}

export function verifyGuardianWitnessProof({
  payload,
  publicKeyBase64,
  keyIdSha256,
  signatureBase64,
  nowMs = Date.now(),
  allowedPackages = ['ai.laneriq.antiscam'],
} = {}) {
  if (!payload || !allowedPackages.includes(String(payload.packageName || ''))) return null;
  const epoch = Number(payload.leaseEpoch || 0);
  const sequence = Number(payload.heartbeatSequence || 0);
  const observed = Number(payload.observedAtMs || 0);
  const expires = Number(payload.leaseExpiresAtMs || 0);
  if (!Number.isSafeInteger(epoch) || epoch <= 0 || !Number.isSafeInteger(sequence) || sequence <= 0) return null;
  if (!Number.isFinite(observed) || observed <= 0 || observed > nowMs + MAX_FUTURE_SKEW_MS || nowMs - observed > MAX_OBSERVED_AGE_MS) return null;
  if (!Number.isFinite(expires) || expires <= observed) return null;
  if (!/^[0-9a-f]{64}$/i.test(String(keyIdSha256 || ''))) return null;

  try {
    const publicDer = Buffer.from(String(publicKeyBase64 || ''), 'base64');
    if (!publicDer.length) return null;
    const actualKeyId = crypto.createHash('sha256').update(publicDer).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(actualKeyId, 'hex'), Buffer.from(String(keyIdSha256).toLowerCase(), 'hex'))) return null;
    const publicKey = crypto.createPublicKey({ key: publicDer, type: 'spki', format: 'der' });
    if (publicKey.asymmetricKeyType !== 'ec') return null;
    const signature = Buffer.from(String(signatureBase64 || ''), 'base64');
    if (!signature.length) return null;
    const canonical = canonicalGuardianWitness(payload);
    if (!crypto.verify('sha256', Buffer.from(canonical, 'utf8'), publicKey, signature)) return null;

    return Object.freeze({
      keyIdSha256: actualKeyId,
      payload: Object.freeze({
        packageName: String(payload.packageName),
        leaseEpoch: epoch,
        heartbeatSequence: sequence,
        leaseExpiresAtMs: expires,
        integrityState: safeToken(payload.integrityState),
        emergencyLevel: safeToken(payload.emergencyLevel),
        alertDeliveryState: safeToken(payload.alertDeliveryState),
        policyVersion: safeToken(payload.policyVersion),
        observedAtMs: observed,
      }),
    });
  } catch {
    return null;
  }
}
