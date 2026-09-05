import { createHmac } from 'node:crypto';
import { canonicalEvent, requireNonEmpty } from './contracts.mjs';

export function pseudonymizeInstallationId(installationId, privacySalt) {
  requireNonEmpty(installationId, 'installationId');
  requireNonEmpty(privacySalt, 'privacySalt');
  return createHmac('sha256', privacySalt).update(installationId).digest('hex').slice(0, 32);
}

export function minimizeTelemetry(input = {}, { privacySalt } = {}) {
  const event = canonicalEvent(input);
  const devicePseudonym = pseudonymizeInstallationId(event.installationId, privacySalt);
  return Object.freeze({
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
}

export const DISALLOWED_DEFAULT_TELEMETRY_FIELDS = Object.freeze([
  'rawUrl', 'rawText', 'messageBody', 'fileName', 'filePath', 'contactName', 'phoneNumber',
  'emailAddress', 'password', 'cookie', 'authToken', 'photo', 'rawFile', 'clipboard',
]);

export function containsDisallowedDefaultField(envelope = {}) {
  return DISALLOWED_DEFAULT_TELEMETRY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(envelope, field));
}
