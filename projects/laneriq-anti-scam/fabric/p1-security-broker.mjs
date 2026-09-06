import { ProtectionState, requireNonEmpty, stableDedupeKey } from './contracts.mjs';
import { verifyGuardianProof } from './p0-guardian-proof.mjs';

export class SecurityBroker {
  constructor({ trustedPublisherDigest, now = () => Date.now(), dedupeWindowMs = 30_000 } = {}) {
    this.trustedPublisherDigest = requireNonEmpty(trustedPublisherDigest, 'trustedPublisherDigest');
    this.now = now;
    this.dedupeWindowMs = dedupeWindowMs;
    this.guardian = null;
    this.requests = new Map();
  }

  registerGuardianProof(proof = {}) {
    if (proof.publisherDigest !== this.trustedPublisherDigest) {
      this.guardian = null;
      return { state: ProtectionState.UNKNOWN, reason: 'untrusted_guardian_publisher' };
    }
    const verified = verifyGuardianProof(proof, { nowMs: this.now() });
    if (!verified.valid) {
      this.guardian = null;
      return { state: verified.state, reason: verified.reason };
    }
    return this.#acceptVerifiedGuardian(verified);
  }

  #acceptVerifiedGuardian(verified) {
    const installationId = requireNonEmpty(verified.installationId, 'installationId');
    const sessionId = requireNonEmpty(verified.sessionId, 'sessionId');
    const leaseExpiresAtMs = Number(verified.leaseExpiresAtMs);
    if (!Number.isFinite(leaseExpiresAtMs) || leaseExpiresAtMs <= this.now()) {
      this.guardian = null;
      return { state: ProtectionState.DEGRADED, reason: 'verified_lease_not_fresh' };
    }
    this.guardian = Object.freeze({
      installationId,
      sessionId,
      leaseEpoch: Number(verified.leaseEpoch),
      heartbeatSequence: Number(verified.heartbeatSequence),
      leaseExpiresAtMs,
      state: ProtectionState.ACTIVE,
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
