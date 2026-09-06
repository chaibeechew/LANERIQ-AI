export const ProtectionState = Object.freeze({
  ACTIVE: 'ACTIVE',
  DEGRADED: 'DEGRADED',
  PAUSED: 'PAUSED',
  UNKNOWN: 'UNKNOWN',
});

export const RiskLevel = Object.freeze({
  LOW: 'LOW',
  REVIEW: 'REVIEW',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
});

export function requireNonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function canonicalEvent(input = {}) {
  const eventId = requireNonEmpty(input.eventId, 'eventId');
  const installationId = requireNonEmpty(input.installationId, 'installationId');
  const type = requireNonEmpty(input.type, 'type').toLowerCase();
  const occurredAtMs = Number(input.occurredAtMs);
  if (!Number.isFinite(occurredAtMs) || occurredAtMs <= 0) {
    throw new Error('occurredAtMs must be a positive number');
  }
  return Object.freeze({
    schemaVersion: 1,
    eventId,
    installationId,
    type,
    occurredAtMs,
    risk: input.risk && Object.values(RiskLevel).includes(input.risk) ? input.risk : RiskLevel.UNKNOWN,
    fingerprint: typeof input.fingerprint === 'string' ? input.fingerprint.slice(0, 256) : '',
    source: typeof input.source === 'string' ? input.source.slice(0, 64) : 'unknown',
    regionHint: typeof input.regionHint === 'string' ? input.regionHint.slice(0, 32) : '',
    evidence: Array.isArray(input.evidence) ? input.evidence.slice(0, 32) : [],
  });
}

export function stableDedupeKey(parts = []) {
  return parts.map((p) => String(p ?? '').trim().toLowerCase()).join('|');
}
