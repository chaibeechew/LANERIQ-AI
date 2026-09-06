import { readFileSync } from 'node:fs';
import { verifyEd25519Policy } from '../fabric/p5-policy-signature.mjs';

const TOKEN = Symbol('LANERIQ_VERIFIED_RELEASE_EVIDENCE');
const KEY_STORE_URL = new URL('./TRUSTED_RELEASE_EVIDENCE_KEYS.json', import.meta.url);
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_EVIDENCE_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function loadTrustedKeys() {
  const raw = JSON.parse(readFileSync(KEY_STORE_URL, 'utf8'));
  const keys = raw && typeof raw.keys === 'object' && raw.keys ? raw.keys : {};
  return keys;
}

function validPayload(payload, nowMs) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.status !== 'PASS') return false;
  if (typeof payload.gateId !== 'string' || payload.gateId.trim() === '') return false;
  if (typeof payload.proofRef !== 'string' || payload.proofRef.trim() === '') return false;
  if (typeof payload.verifierId !== 'string' || payload.verifierId.trim() === '') return false;
  const measuredAtMs = Number(payload.measuredAtMs || 0);
  if (!Number.isFinite(measuredAtMs) || measuredAtMs <= 0) return false;
  if (measuredAtMs > nowMs + MAX_FUTURE_SKEW_MS) return false;
  if (nowMs - measuredAtMs > MAX_EVIDENCE_AGE_MS) return false;
  return true;
}

export function verifyPinnedReleaseEvidence({ payload, signatureBase64, nowMs = Date.now() } = {}) {
  if (!validPayload(payload, nowMs)) return null;
  const keys = loadTrustedKeys();
  const publicKeyPem = keys[payload.verifierId];
  if (typeof publicKeyPem !== 'string' || publicKeyPem.trim() === '') return null;
  if (!verifyEd25519Policy({ payload, publicKeyPem, signatureBase64 })) return null;

  return Object.freeze({
    [TOKEN]: true,
    gateId: payload.gateId.trim(),
    proofRef: payload.proofRef.trim(),
    verifierId: payload.verifierId.trim(),
    measuredAtMs: Number(payload.measuredAtMs),
  });
}

export function isVerifiedReleaseEvidence(value, expectedGateId) {
  return Boolean(
    value
    && value[TOKEN] === true
    && typeof value.gateId === 'string'
    && value.gateId === expectedGateId,
  );
}

export function trustedReleaseEvidenceKeyCount() {
  return Object.keys(loadTrustedKeys()).length;
}
