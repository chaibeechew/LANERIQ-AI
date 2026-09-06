export const ReplayDecision = Object.freeze({
  ACCEPT: 'ACCEPT',
  REJECT_STALE: 'REJECT_STALE',
  REJECT_FUTURE: 'REJECT_FUTURE',
  REJECT_EPOCH_ROLLBACK: 'REJECT_EPOCH_ROLLBACK',
  REJECT_SEQUENCE_REPLAY: 'REJECT_SEQUENCE_REPLAY',
  REJECT_IDENTITY_MISMATCH: 'REJECT_IDENTITY_MISMATCH',
  REJECT_INVALID: 'REJECT_INVALID',
});

/**
 * Anti-replay state for privacy-safe Guardian witness heartbeats.
 *
 * This proves monotonic freshness only. It does not prove cryptographic device
 * origin. Production remote attestation/device-held signing is a separate gate.
 */
export class GuardianWitnessReplayGuard {
  constructor({ maxAgeMs = 180_000, maxFutureSkewMs = 30_000 } = {}) {
    this.maxAgeMs = Math.max(1_000, Number(maxAgeMs) || 180_000);
    this.maxFutureSkewMs = Math.max(0, Number(maxFutureSkewMs) || 30_000);
    this.state = new Map();
  }

  evaluate(heartbeat, { nowMs = Date.now() } = {}) {
    if (!heartbeat || typeof heartbeat !== 'object') {
      return this.#reject(ReplayDecision.REJECT_INVALID, 'missing_heartbeat');
    }

    const devicePseudonym = String(heartbeat.devicePseudonym || '').trim();
    const leaseEpoch = Number(heartbeat.leaseEpoch);
    const heartbeatSequence = Number(heartbeat.heartbeatSequence);
    const observedAtMs = Number(heartbeat.observedAtMs);
    if (!devicePseudonym
        || !Number.isSafeInteger(leaseEpoch) || leaseEpoch < 0
        || !Number.isSafeInteger(heartbeatSequence) || heartbeatSequence <= 0
        || !Number.isFinite(observedAtMs) || observedAtMs <= 0
        || !Number.isFinite(nowMs) || nowMs <= 0) {
      return this.#reject(ReplayDecision.REJECT_INVALID, 'invalid_heartbeat_fields');
    }

    if (observedAtMs > nowMs + this.maxFutureSkewMs) {
      return this.#reject(ReplayDecision.REJECT_FUTURE, 'heartbeat_from_future');
    }
    if (nowMs - observedAtMs > this.maxAgeMs) {
      return this.#reject(ReplayDecision.REJECT_STALE, 'heartbeat_too_old');
    }

    const previous = this.state.get(devicePseudonym);
    if (previous) {
      if (leaseEpoch < previous.leaseEpoch) {
        return this.#reject(ReplayDecision.REJECT_EPOCH_ROLLBACK, 'lease_epoch_rollback');
      }
      if (leaseEpoch === previous.leaseEpoch
          && heartbeatSequence <= previous.heartbeatSequence) {
        return this.#reject(ReplayDecision.REJECT_SEQUENCE_REPLAY, 'heartbeat_sequence_not_monotonic');
      }
      if (leaseEpoch > previous.leaseEpoch && heartbeatSequence <= 0) {
        return this.#reject(ReplayDecision.REJECT_INVALID, 'new_epoch_requires_positive_sequence');
      }
    }

    this.state.set(devicePseudonym, Object.freeze({
      leaseEpoch,
      heartbeatSequence,
      observedAtMs,
    }));
    return Object.freeze({
      decision: ReplayDecision.ACCEPT,
      accepted: true,
      reason: previous ? 'fresh_monotonic_heartbeat' : 'first_fresh_heartbeat',
      leaseEpoch,
      heartbeatSequence,
    });
  }

  snapshot(devicePseudonym) {
    const key = String(devicePseudonym || '').trim();
    return key && this.state.has(key) ? this.state.get(key) : null;
  }

  clear(devicePseudonym) {
    const key = String(devicePseudonym || '').trim();
    if (key) this.state.delete(key);
  }

  #reject(decision, reason) {
    return Object.freeze({ decision, accepted: false, reason });
  }
}
