import { requireNonEmpty } from './contracts.mjs';

export class ActiveActiveRegionSet {
  constructor(regions = []) {
    this.regions = new Map();
    for (const region of regions) this.addRegion(region);
  }

  addRegion(region = {}) {
    const id = requireNonEmpty(region.id, 'region.id');
    this.regions.set(id, {
      id,
      group: typeof region.group === 'string' ? region.group : 'global',
      healthy: region.healthy !== false,
      readOnly: region.readOnly === true,
      latencyMs: Number.isFinite(region.latencyMs) ? Math.max(0, region.latencyMs) : 9999,
      load: Number.isFinite(region.load) ? Math.max(0, region.load) : 0,
      evacuation: false,
    });
  }

  setHealth(id, { healthy, readOnly, latencyMs, load } = {}) {
    const region = this.regions.get(id);
    if (!region) throw new Error('unknown region');
    if (typeof healthy === 'boolean') region.healthy = healthy;
    if (typeof readOnly === 'boolean') region.readOnly = readOnly;
    if (Number.isFinite(latencyMs)) region.latencyMs = Math.max(0, latencyMs);
    if (Number.isFinite(load)) region.load = Math.max(0, load);
  }

  evacuate(id, enabled = true) {
    const region = this.regions.get(id);
    if (!region) throw new Error('unknown region');
    region.evacuation = Boolean(enabled);
  }

  select({ preferredGroup = '', write = false, exclude = [] } = {}) {
    const excluded = new Set(exclude);
    let candidates = [...this.regions.values()].filter((r) =>
      r.healthy && !r.evacuation && !excluded.has(r.id) && (!write || !r.readOnly));
    if (preferredGroup) {
      const grouped = candidates.filter((r) => r.group === preferredGroup);
      if (grouped.length > 0) candidates = grouped;
    }
    candidates.sort((a, b) => (a.load - b.load) || (a.latencyMs - b.latencyMs) || a.id.localeCompare(b.id));
    if (candidates.length === 0) return { region: null, degraded: true, reason: 'no_writable_healthy_region' };
    return {
      region: candidates[0].id,
      degraded: false,
      reason: 'active_active_selection',
      candidateCount: candidates.length,
    };
  }

  resilienceSummary() {
    const all = [...this.regions.values()];
    const healthy = all.filter((r) => r.healthy && !r.evacuation);
    const writable = healthy.filter((r) => !r.readOnly);
    return {
      totalRegions: all.length,
      healthyRegions: healthy.length,
      writableRegions: writable.length,
      survivesSingleRegionLoss: writable.length >= 2,
    };
  }
}
