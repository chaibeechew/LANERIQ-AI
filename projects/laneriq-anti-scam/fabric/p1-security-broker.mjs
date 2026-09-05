import { ProtectionState, requireNonEmpty, stableDedupeKey } from './contracts.mjs';

export class SecurityBroker {
  constructor({ trustedPublisherDigest, now = () => Date.now(), dedupeWindowMs = 30_000 } = {}) {
    this.trustedPublisherDigest = requireNonEmpty(trustedPublisherDigest, 'trustedPublisherDigest');
    this.now = now;
    this.dedupeWindowMs = dedupeWindowMs;
    this.guardian = null;
    this.requests = new Map();
  }

  registerGuardian(candidate = {}) {
    if (candidate.publisherDigest !== this.trustedPublisherDigest) {
      throw new Error('untrusted guardian publisher');
    }
    const installationId = requireNonEmpty(candidate.installationId, 'installationId');
    const sessionId = requireNonEmpty(candidate.sessionId, 'sessionId');
    const leaseExpiresAtMs = Number(candidate.leaseExpiresAtMs);
    if (!Number.isFinite(leaseExpiresAtMs) || leaseExpiresAtMs <= 0) {
      throw new Error('invalid guardian lease expiry');
    }
    this.guardian = Object.freeze({
      installationId,
      sessionId,
      leaseEpoch: Number(candidate.leaseEpoch) || 0,
      heartbeatSequence: Number(candidate.heartbeatSequence) || 0,
      leaseExpiresAtMs,
      state: candidate.state === ProtectionState.ACTIVE ? ProtectionState.ACTIVE : ProtectionState.DEGRADED,
    });
    return this.status();
  }

  clearGuardian() {
    this.guardian = null;
  }

  status() {
    if (!this.guardian) return { state: ProtectionState.UNKNOWN, reason: 'guardian_unavailable' };
    if (this.now() > this.guardian.leaseExpiresAtMs) {
      return { state: ProtectionState.DEGRADED, reason: 'lease_expired' };
    }
    if (this.guardian.state !== ProtectionState.ACTIVE) {
      return { state: ProtectionState.DEGRADED, reason: 'guardian_not_active' };
    }
    return {
      state: ProtectionState.ACTIVE,
      reason: 'fresh_verified_lease',
      installationId: this.guardian.installationId,
      sessionId: this.guardian.sessionId,
      leaseEpoch: this.guardian.leaseEpoch,
      heartbeatSequence: this.guardian.heartbeatSequence,
    };
  }

  admitRequest({ clientPackage, publisherDigest, operation, fingerprint = '' } = {}) {
    requireNonEmpty(clientPackage, 'clientPackage');
    requireNonEmpty(operation, 'operation');
    if (publisherDigest !== this.trustedPublisherDigest) {
      return { admitted: false, reason: 'untrusted_client' };
    }
    const key = stableDedupeKey([clientPackage, operation, fingerprint]);
    const now = this.now();
    const previous = this.requests.get(key) || 0;
    if (previous > 0 && now - previous < this.dedupeWindowMs) {
      return { admitted: false, reason: 'duplicate_request' };
    }
    this.requests.set(key, now);
    return { admitted: true, reason: 'trusted_unique_request', key };
  }
}
