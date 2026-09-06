import { createHash, createPublicKey, verify } from 'node:crypto';

function safeToken(value) {
  const v = String(value ?? '').trim();
  return (v || 'unknown').replace(/[\n\r=]/g, '_');
}

export function canonicalWitnessProofPayload({
  packageName,
  leaseEpoch,
  heartbeatSequence,
  leaseExpiresAtMs,
  integrityState,
  emergencyLevel,
  alertDeliveryState,
  policyVersion,
  observedAtMs,
  schemaVersion = 1,
} = {}) {
  const epoch = Math.max(0, Number(leaseEpoch || 0));
  const sequence = Math.max(0, Number(heartbeatSequence || 0));
  const expires = Math.max(0, Number(leaseExpiresAtMs || 0));
  const observed = Math.max(0, Number(observedAtMs || 0));
  return `schema=${Math.max(0, Number(schemaVersion || 0))}\n`
    + `package=${safeToken(packageName)}\n`
    + `epoch=${epoch}\n`
    + `sequence=${sequence}\n`
    + `expires=${expires}\n`
    + `integrity=${safeToken(integrityState)}\n`
    + `emergency=${safeToken(emergencyLevel)}\n`
    + `alerts=${safeToken(alertDeliveryState)}\n`
    + `policy=${safeToken(policyVersion)}\n`
    + `observed=${observed}\n`;
}

export function verifyWitnessCryptoProof({
  payload,
  publicKeyBase64,
  signatureBase64,
  keyIdSha256,
} = {}) {
  const fail = (reason) => Object.freeze({ verified: false, reason });
  if (!payload || typeof payload !== 'object') return fail('invalid_payload');
  if (typeof publicKeyBase64 !== 'string' || !publicKeyBase64.trim()) return fail('missing_public_key');
  if (typeof signatureBase64 !== 'string' || !signatureBase64.trim()) return fail('missing_signature');
  if (typeof keyIdSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(keyIdSha256.trim())) {
    return fail('invalid_key_id');
  }

  try {
    const publicDer = Buffer.from(publicKeyBase64, 'base64');
    if (!publicDer.length) return fail('invalid_public_key');
    const computedKeyId = createHash('sha256').update(publicDer).digest('hex');
    if (computedKeyId !== keyIdSha256.trim().toLowerCase()) return fail('key_id_mismatch');

    const key = createPublicKey({ key: publicDer, format: 'der', type: 'spki' });
    const canonical = canonicalWitnessProofPayload(payload);
    const signature = Buffer.from(signatureBase64, 'base64');
    if (!signature.length) return fail('invalid_signature');
    const ok = verify('sha256', Buffer.from(canonical, 'utf8'), key, signature);
    if (!ok) return fail('signature_invalid');
    return Object.freeze({
      verified: true,
      reason: 'android_keystore_witness_signature_verified',
      keyIdSha256: computedKeyId,
      canonicalPayload: canonical,
    });
  } catch {
    return fail('signature_invalid');
  }
}

export const WitnessKeyState = Object.freeze({
  UNENROLLED: 'UNENROLLED',
  VERIFIED: 'VERIFIED',
  KEY_CHANGED_REENROLL_REQUIRED: 'KEY_CHANGED_REENROLL_REQUIRED',
});

export class WitnessKeyContinuity {
  constructor() {
    this.pins = new Map();
  }

  status(slot, observedKeyIdSha256) {
    const id = safeSlot(slot);
    const keyId = normalizeKeyId(observedKeyIdSha256);
    if (!keyId) return Object.freeze({ state: WitnessKeyState.UNENROLLED, trusted: false });
    const pinned = this.pins.get(id);
    if (!pinned) return Object.freeze({ state: WitnessKeyState.UNENROLLED, trusted: false, observedKeyIdSha256: keyId });
    if (pinned === keyId) return Object.freeze({ state: WitnessKeyState.VERIFIED, trusted: true, keyIdSha256: keyId });
    return Object.freeze({
      state: WitnessKeyState.KEY_CHANGED_REENROLL_REQUIRED,
      trusted: false,
      pinnedKeyIdSha256: pinned,
      observedKeyIdSha256: keyId,
    });
  }

  enroll(slot, keyIdSha256, { packageSignatureTrustVerified = false } = {}) {
    if (!packageSignatureTrustVerified) throw new Error('package signature trust required before witness key enrollment');
    const id = safeSlot(slot);
    const keyId = normalizeKeyId(keyIdSha256);
    if (!keyId) throw new Error('valid witness key id required');
    this.pins.set(id, keyId);
    return this.status(id, keyId);
  }
}

function safeSlot(slot) {
  const id = String(slot ?? '').trim();
  if (!id) throw new Error('witness slot required');
  return id;
}

function normalizeKeyId(value) {
  const keyId = String(value ?? '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(keyId) ? keyId : '';
}
