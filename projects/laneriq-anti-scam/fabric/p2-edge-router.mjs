import { requireNonEmpty, stableDedupeKey } from './contracts.mjs';

export class RegionalEdgeRouter {
  constructor({ regions = [], now = () => Date.now(), dedupeWindowMs = 60_000, perDeviceWindowMs = 60_000, perDeviceLimit = 120 } = {}) {
    this.regions = new Map();
    for (const region of regions) this.setRegion(region);
    this.now = now;
    this.dedupeWindowMs = dedupeWindowMs;
    this.perDeviceWindowMs = perDeviceWindowMs;
    this.perDeviceLimit = perDeviceLimit;
    this.dedupe = new Map();
    this.deviceCounters = new Map();
  }

  setRegion(region = {}) {
    const id = requireNonEmpty(region.id, 'region.id');
    this.regions.set(id, {
      id,
      priority: Number.isFinite(region.priority) ? region.priority : 100,
      healthy: region.healthy !== false,
      acceptsWrites: region.acceptsWrites !== false,
    });
  }

  markHealth(id, healthy, acceptsWrites = healthy) {
    const region = this.regions.get(id);
    if (!region) throw new Error('unknown region');
    region.healthy = Boolean(healthy);
    region.acceptsWrites = Boolean(acceptsWrites);
  }

  route({ preferredRegion = '', write = false } = {}) {
    const candidates = [...this.regions.values()]
      .filter((r) => r.healthy && (!write || r.acceptsWrites))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    if (preferredRegion) {
      const preferred = candidates.find((r) => r.id === preferredRegion);
      if (preferred) return { region: preferred.id, fallback: false };
    }
    if (candidates.length === 0) return { region: null, fallback: true, reason: 'no_healthy_region' };
    return { region: candidates[0].id, fallback: Boolean(preferredRegion), reason: preferredRegion ? 'preferred_unavailable' : 'best_healthy_region' };
  }

  admitEvent({ installationId, type, fingerprint = '' } = {}) {
    requireNonEmpty(installationId, 'installationId');
    requireNonEmpty(type, 'type');
    const now = this.now();
    const counter = this.deviceCounters.get(installationId) || { startedAtMs: now, count: 0 };
    if (now - counter.startedAtMs >= this.perDeviceWindowMs) {
      counter.startedAtMs = now;
      counter.count = 0;
    }
    if (counter.count >= this.perDeviceLimit) return { admitted: false, reason: 'device_rate_limited' };

    const key = stableDedupeKey([installationId, type, fingerprint]);
    const previous = this.dedupe.get(key) || 0;
    if (previous && now - previous < this.dedupeWindowMs) return { admitted: false, reason: 'duplicate_event' };

    counter.count += 1;
    this.deviceCounters.set(installationId, counter);
    this.dedupe.set(key, now);
    return { admitted: true, reason: 'accepted', idempotencyKey: key };
  }
}
