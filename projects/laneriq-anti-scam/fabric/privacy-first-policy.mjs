export const PrivacyMode = Object.freeze({
  STRICT_LOCAL_FIRST: 'STRICT_LOCAL_FIRST',
});

export const DEFAULT_ALLOWED_CLOUD_FIELDS = Object.freeze([
  'schemaVersion',
  'eventId',
  'devicePseudonym',
  'type',
  'occurredAtMs',
  'risk',
  'threatFingerprint',
  'source',
  'regionHint',
  'evidenceCount',
]);

export const DEFAULT_FORBIDDEN_CLOUD_FIELDS = Object.freeze([
  'rawUrl',
  'fullBrowsingHistory',
  'rawText',
  'messageBody',
  'clipboard',
  'photo',
  'video',
  'microphoneAudio',
  'contactName',
  'contacts',
  'phoneNumber',
  'emailAddress',
  'password',
  'cookie',
  'authToken',
  'rawFile',
  'filePath',
  'privateKey',
  'screenCapture',
]);

export function validatePrivacyEnvelope(envelope = {}) {
  const keys = Object.keys(envelope);
  const forbidden = keys.filter((key) => DEFAULT_FORBIDDEN_CLOUD_FIELDS.includes(key));
  const unknown = keys.filter((key) => !DEFAULT_ALLOWED_CLOUD_FIELDS.includes(key));
  return {
    valid: forbidden.length === 0 && unknown.length === 0,
    forbidden,
    unknown,
  };
}

export function privacyTruth() {
  return Object.freeze({
    mode: PrivacyMode.STRICT_LOCAL_FIRST,
    rawPrivateContentUploadByDefault: false,
    remoteMonitoringByDefault: false,
    crossUserComputeOnMobile: false,
    principle: 'Protect the user without turning the user into the product.',
  });
}
