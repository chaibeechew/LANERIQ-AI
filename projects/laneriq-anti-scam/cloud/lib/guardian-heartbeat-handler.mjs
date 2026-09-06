import { verifyGuardianWitnessProof } from './device-witness-verifier.mjs';
import { buildCloudDeadManRecord } from './cloud-deadman.mjs';
import { upsertDeadManRecord } from './supabase-deadman-store.mjs';
import { assertGuardianCloudAdmission } from './guardian-admission-policy.mjs';

const PROOF_FIELDS = new Set(['payload', 'publicKeyBase64', 'keyIdSha256', 'signatureBase64']);
const PAYLOAD_FIELDS = new Set([
  'packageName', 'leaseEpoch', 'heartbeatSequence', 'leaseExpiresAtMs',
  'integrityState', 'emergencyLevel', 'alertDeliveryState', 'policyVersion', 'observedAtMs',
]);
const GUARDIAN_PAYLOAD_FORBIDDEN_FIELDS = 'GUARDIAN_PAYLOAD_FORBIDDEN_FIELDS';

function rejectUnknownFields(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`${label}_OBJECT_REQUIRED`);
  const unknown = Object.keys(object).filter(key => !allowed.has(key));
  if (unknown.length) {
    const code = label === 'GUARDIAN_PAYLOAD' ? GUARDIAN_PAYLOAD_FORBIDDEN_FIELDS : `${label}_FORBIDDEN_FIELDS`;
    throw new Error(`${code}:${unknown.join(',')}`);
  }
}

function requestBytes(proof, attestationToken) {
  return Buffer.byteLength(JSON.stringify({ proof, attestationToken: String(attestationToken || '') }), 'utf8');
}

/**
 * Production heartbeat admission requires independent controls:
 * 1) trusted ingress + request-size + regional residency admission;
 * 2) app/device attestation for the approved Anti Scam package/build;
 * 3) per-install Android Keystore Witness signature verification;
 * 4) durable DB monotonic/replay/rate-limit enforcement at storage time.
 *
 * Unknown payload fields are rejected instead of silently dropped so accidental
 * private-content telemetry expansion is a hard failure.
 */
export async function handleGuardianHeartbeat({
  proof,
  attestationToken,
  nowMs = Date.now(),
  attestationVerifier,
  store = upsertDeadManRecord,
  pseudonymKey = process.env.LANERIQ_ANTI_SCAM_PSEUDONYM_KEY,
  requestContext = {},
  deploymentRegion = process.env.LANERIQ_ANTI_SCAM_DEPLOYMENT_REGION,
  allowedRegions = process.env.LANERIQ_ANTI_SCAM_ALLOWED_REGIONS,
} = {}) {
  rejectUnknownFields(proof, PROOF_FIELDS, 'GUARDIAN_PROOF');
  rejectUnknownFields(proof.payload, PAYLOAD_FIELDS, 'GUARDIAN_PAYLOAD');

  const admission = assertGuardianCloudAdmission({
    requestContext: {
      ...requestContext,
      requestBytes: requestBytes(proof, attestationToken),
    },
    deploymentRegion,
    allowedRegions,
  });

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
    deploymentRegion: admission.deploymentRegion,
    privateContentAccepted: false,
  });
}
