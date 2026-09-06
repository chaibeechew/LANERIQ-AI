import { createHmac } from 'node:crypto';
import { canonicalEvent, requireNonEmpty } from './contracts.mjs';
import { DEFAULT_FORBIDDEN_CLOUD_FIELDS, validatePrivacyEnvelope } from './privacy-first-policy.mjs';

export function pseudonymizeInstallationId(installationId, privacySalt) {
  requireNonEmpty(installationId, 'installationId');
  requireNonEmpty(privacySalt, 'privacySalt');
  return createHmac('sha256', privacySalt).update(installationId).digest('hex').slice(0, 32);
}

export function minimizeTelemetry(input = {}, { privacySalt } = {}) {
  const forbiddenInput = Object.keys(input).filter((key) =>
    DEFAULT_FORBIDDEN_CLOUD_FIELDS.includes(key) || DISALLOWED_DEFAULT_TELEMETRY_FIELDS.includes(key));
  if (forbiddenInput.length > 0) {
    throw new Error(`private telemetry field rejected: ${forbiddenInput.sort().join(',')}`);
  }

  const event = canonicalEvent(input);
  const devicePseudonym = pseudonymizeInstallationId(event.installationId, privacySalt);
  const envelope = Object.freeze({
    schemaVersion: 1,
    eventId: event.eventId,
    devicePseudonym,
    type: event.type,
    occurredAtMs: event.occurredAtMs,
    risk: event.risk,
    threatFingerprint: event.fingerprint,
    source: event.source,
    regionHint: event.regionHint,
    evidenceCount: event.evidence.length,
  });

  const validation = validatePrivacyEnvelope(envelope);
  if (!validation.valid) {
    throw new Error(`privacy envelope rejected: ${[...validation.forbidden, ...validation.unknown].sort().join(',')}`);
  }
  return envelope;
}

export const DISALLOWED_DEFAULT_TELEMETRY_FIELDS = Object.freeze([
  'rawUrl', 'fullBrowsingHistory', 'rawText', 'messageBody', 'fileName', 'filePath',
  'contactName', 'contacts', 'phoneNumber', 'emailAddress', 'password', 'cookie', 'authToken',
  'privateKey', 'photo', 'video', 'microphoneAudio', 'rawFile', 'clipboard', 'screenCapture', 'screenContent',
]);

export function containsDisallowedDefaultField(envelope = {}) {
  return DISALLOWED_DEFAULT_TELEMETRY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(envelope, field));
}
