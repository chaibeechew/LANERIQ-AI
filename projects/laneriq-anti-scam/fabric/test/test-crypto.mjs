import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalPolicyPayload } from '../p5-policy-signature.mjs';
import { canonicalMalwareEvidence } from '../malware-evidence.mjs';

export function signedPolicy(payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const message = Buffer.from(canonicalPolicyPayload(payload), 'utf8');
  const signatureBase64 = sign(null, message, privateKey).toString('base64');
  return { payload, publicKeyPem, signatureBase64 };
}

export function signedMalwareEvidence(payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const message = Buffer.from(canonicalMalwareEvidence(payload), 'utf8');
  const signatureBase64 = sign(null, message, privateKey).toString('base64');
  return { payload, publicKeyPem, signatureBase64 };
}
