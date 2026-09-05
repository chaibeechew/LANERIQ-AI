import { requireNonEmpty } from './contracts.mjs';

export class EvidenceProvenanceLedger {
  constructor() {
    this.entries = new Map();
  }

  append({ evidenceId, eventId, source, sourceVersion, policyVersion = '', modelVersion = '', confidence = null, detail = '' } = {}) {
    evidenceId = requireNonEmpty(evidenceId, 'evidenceId');
    eventId = requireNonEmpty(eventId, 'eventId');
    source = requireNonEmpty(source, 'source');
    sourceVersion = requireNonEmpty(sourceVersion, 'sourceVersion');
    if (this.entries.has(evidenceId)) throw new Error('duplicate evidenceId');
    const normalizedConfidence = confidence == null ? null : Number(confidence);
    if (normalizedConfidence != null && (!Number.isFinite(normalizedConfidence) || normalizedConfidence < 0 || normalizedConfidence > 1)) {
      throw new Error('confidence must be between 0 and 1');
    }
    const entry = Object.freeze({
      evidenceId,
      eventId,
      source,
      sourceVersion,
      policyVersion: String(policyVersion || ''),
      modelVersion: String(modelVersion || ''),
      confidence: normalizedConfidence,
      detail: String(detail || '').slice(0, 512),
    });
    this.entries.set(evidenceId, entry);
    return entry;
  }

  trace(evidenceIds = []) {
    const found = [];
    const missing = [];
    for (const id of evidenceIds) {
      const entry = this.entries.get(id);
      if (entry) found.push(entry);
      else missing.push(id);
    }
    return { complete: missing.length === 0, found, missing };
  }

  canSupportHighRiskVerdict(evidenceIds = []) {
    const trace = this.trace(evidenceIds);
    if (!trace.complete || trace.found.length < 2) return false;
    const distinctSources = new Set(trace.found.map((e) => e.source));
    return distinctSources.size >= 2;
  }
}
