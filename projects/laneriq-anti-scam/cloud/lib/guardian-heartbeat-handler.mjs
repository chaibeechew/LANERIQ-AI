import { verifyGuardianWitnessProof } from './device-witness-verifier.mjs';
import { buildCloudDeadManRecord } from './cloud-deadman.mjs';
import { upsertDeadManRecord } from './supabase-deadman-store.mjs';

const PROOF_FIELDS = new Set(['payload', 'publicKeyBase64', 'keyIdSha256', 'signatureBase64']);
const PAYLOAD_FIELDS = new Set([
  'packageName', 'leaseEpoch', 'heartbeatSequence', 'leaseExpiresAtMs',
  'integrityState', 'emergencyLevel', 'alertDeliveryState', 'policyVersion', 'observedAtMs',
]);

function rejectUnknownFields(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`${label}_OBJECT_REQUIRED`);
  const unknown = Object.keys(object).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`${label}_FORBIDDEN_FIELDS:${unknown.join(',')}`);
}

/**
 * Production heartbeat admission requires two independent properties:
 * 1) app/device attestation says this is the approved Anti Scam package/build;
 * 2) the per-install Android Keystore Witness signature verifies.
 *
 * The endpoint rejects unknown fields instead of silently dropping them. That
 * makes accidental uploads of URLs, messages, filenames or screen content a
 * hard privacy failure rather than hidden telemetry expansion.
 */
export async function handleGuardianHeartbeat({
  proof,
  attestationToken,
  nowMs = Date.now(),
  attestationVerifier,
  store = upsertDeadManRecord,
  pseudonymKey = process.env.LANERIQ_ANTI_SCAM_PSEUDONYM_KEY,
} = {}) {
  rejectUnknownFields(proof, PROOF_FIELDS, 'GUARDIAN_PROOF');
  rejectUnknownFields(proof.payload, PAYLOAD_FIELDS, 'GUARDIAN_PAYLOAD');

  if (typeof attestationVerifier !== 'function') throw new Error('APP_ATTESTATION_VERIFIER_NOT_CONFIGURED');
  const attestation = await attestationVerifier(attestationToken, { nowMs });
  if (!attestation?.ok) throw new Error('APP_ATTESTATION_REJECTED');
  if (attestation.packageName !== 'ai.laneriq.antiscam') throw new Error('UNTRUSTED_APP_PACKAGE');
  if (attestation.appIntegrityVerified !== true) throw new Error('APP_INTEGRITY_NOT_VERIFIED');

  const verified = verifyGuardianWitnessProof({
    payload: proof.payload,
    publicKeyBase64: proof.publicKeyBase64,
    keyIdSha256: proof.keyIdSha256,
    signatureBase64: proof.signatureBase64,
    nowMs,
    allowedPackages: ['ai.laneriq.antiscam'],
  });
  if (!verified) throw new Error('INVALID_GUARDIAN_WITNESS_PROOF');

  const record = buildCloudDeadManRecord(verified, { receivedAtMs: nowMs, pseudonymKey });
  await store(record);
  return Object.freeze({
    accepted: true,
    nextHeartbeatAfterMs: 60_000,
    stateStored: true,
    privateContentAccepted: false,
  });
}
