import { verify } from 'node:crypto';

function canonicalizeValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalizeValue(value[key]);
    return out;
  }
  return value;
}

export function canonicalPolicyPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('policy payload must be an object');
  }
  return JSON.stringify(canonicalizeValue(payload));
}

export function verifyEd25519Policy({ payload, publicKeyPem, signatureBase64 } = {}) {
  if (typeof publicKeyPem !== 'string' || publicKeyPem.trim() === '') return false;
  if (typeof signatureBase64 !== 'string' || signatureBase64.trim() === '') return false;
  try {
    const message = Buffer.from(canonicalPolicyPayload(payload), 'utf8');
    const signature = Buffer.from(signatureBase64, 'base64');
    if (signature.length === 0) return false;
    return verify(null, message, publicKeyPem, signature);
  } catch {
    return false;
  }
}
