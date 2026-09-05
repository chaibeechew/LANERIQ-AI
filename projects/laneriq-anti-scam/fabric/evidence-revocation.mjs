export class EvidenceRevocationPolicy {
  constructor({ revokedEvidenceIds = [], revokedSourceTypes = [] } = {}) {
    this.revokedEvidenceIds = new Set(revokedEvidenceIds.map(String));
    this.revokedSourceTypes = new Set(revokedSourceTypes.map(String));
  }

  revokeEvidence(evidenceId) {
    if (typeof evidenceId !== 'string' || evidenceId.trim() === '') throw new Error('evidenceId required');
    this.revokedEvidenceIds.add(evidenceId.trim());
  }

  revokeSource(sourceType) {
    if (typeof sourceType !== 'string' || sourceType.trim() === '') throw new Error('sourceType required');
    this.revokedSourceTypes.add(sourceType.trim());
  }

  isRevoked(evidence = {}) {
    if (!evidence || typeof evidence !== 'object') return true;
    return this.revokedEvidenceIds.has(String(evidence.evidenceId || ''))
      || this.revokedSourceTypes.has(String(evidence.sourceType || ''));
  }

  snapshot() {
    return Object.freeze({
      revokedEvidenceIds: Object.freeze([...this.revokedEvidenceIds].sort()),
      revokedSourceTypes: Object.freeze([...this.revokedSourceTypes].sort()),
    });
  }
}

export function evidenceUsable(evidence, revocationPolicy = null) {
  if (!evidence || evidence.verified !== true) return false;
  if (revocationPolicy && revocationPolicy.isRevoked(evidence)) return false;
  return true;
}
