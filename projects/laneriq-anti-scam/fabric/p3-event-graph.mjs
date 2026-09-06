import { RiskLevel, canonicalEvent, clamp01 } from './contracts.mjs';

const WEIGHTS = Object.freeze({
  unknown_apk: 0.35,
  accessibility_enabled: 0.20,
  overlay_risk: 0.25,
  remote_control_signal: 0.35,
  screen_share_signal: 0.25,
  suspicious_domain: 0.35,
  banking_context: 0.20,
  adb_enabled: 0.10,
  developer_options: 0.05,
});

export class SecurityEventGraph {
  constructor({ correlationWindowMs = 10 * 60_000 } = {}) {
    this.correlationWindowMs = correlationWindowMs;
    this.events = new Map();
  }

  add(input) {
    const event = canonicalEvent(input);
    if (this.events.has(event.eventId)) return { accepted: false, reason: 'duplicate_event_id' };
    this.events.set(event.eventId, event);
    return { accepted: true, event };
  }

  incidentFor({ installationId, nowMs = Date.now() } = {}) {
    const relevant = [...this.events.values()]
      .filter((e) => e.installationId === installationId && nowMs - e.occurredAtMs >= 0 && nowMs - e.occurredAtMs <= this.correlationWindowMs)
      .sort((a, b) => a.occurredAtMs - b.occurredAtMs);

    const uniqueTypes = new Set(relevant.map((e) => e.type));
    let score = 0;
    for (const type of uniqueTypes) score += WEIGHTS[type] || 0.08;
    score = clamp01(score);

    const strongCorroboration = uniqueTypes.has('unknown_apk') &&
      (uniqueTypes.has('accessibility_enabled') || uniqueTypes.has('overlay_risk')) &&
      (uniqueTypes.has('remote_control_signal') || uniqueTypes.has('screen_share_signal') || uniqueTypes.has('suspicious_domain'));

    let risk = RiskLevel.LOW;
    if (strongCorroboration && score >= 0.75) risk = RiskLevel.HIGH;
    else if (score >= 0.60 && uniqueTypes.size >= 3) risk = RiskLevel.ELEVATED;
    else if (score >= 0.30) risk = RiskLevel.REVIEW;

    return {
      installationId,
      eventCount: relevant.length,
      uniqueSignalCount: uniqueTypes.size,
      signalTypes: [...uniqueTypes].sort(),
      score,
      risk,
      strongCorroboration,
      malwareVerdict: false,
      explanation: strongCorroboration
        ? 'Multiple independent risk signals correlated; review/escalation is justified, but this is not malware proof.'
        : 'Evidence is insufficient for a malware verdict; preserve signals and continue local/cloud enrichment.',
    };
  }
}
