import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalPolicyPayload } from '../p5-policy-signature.mjs';
import { canonicalMalwareEvidence } from '../malware-evidence.mjs';
import { canonicalWebEvidence } from '../web-reputation-evidence.mjs';

function signPayload(canonical, payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const message = Buffer.from(canonical(payload), 'utf8');
  const signatureBase64 = sign(null, message, privateKey).toString('base64');
  return { payload, publicKeyPem, signatureBase64 };
}

export function signedPolicy(payload) {
  return signPayload(canonicalPolicyPayload, payload);
}

export function signedMalwareEvidence(payload) {
  return signPayload(canonicalMalwareEvidence, payload);
}

export function signedWebEvidence(payload) {
  return signPayload(canonicalWebEvidence, payload);
}
