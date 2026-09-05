import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export class AuditChain {
  constructor() {
    this.entries = [];
  }

  append({ actor = 'system', action, target = '', metadata = {} } = {}) {
    if (typeof action !== 'string' || action.trim() === '') throw new Error('action required');
    const previousHash = this.entries.length ? this.entries[this.entries.length - 1].entryHash : 'GENESIS';
    const body = JSON.stringify({
      index: this.entries.length,
      previousHash,
      actor: String(actor),
      action: action.trim(),
      target: String(target),
      metadata,
    });
    const entry = Object.freeze({
      index: this.entries.length,
      previousHash,
      actor: String(actor),
      action: action.trim(),
      target: String(target),
      metadata,
      entryHash: hash(body),
    });
    this.entries.push(entry);
    return entry;
  }

  verify() {
    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const previousHash = i === 0 ? 'GENESIS' : this.entries[i - 1].entryHash;
      if (entry.previousHash !== previousHash) return { valid: false, index: i, reason: 'previous_hash_mismatch' };
      const body = JSON.stringify({
        index: entry.index,
        previousHash: entry.previousHash,
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        metadata: entry.metadata,
      });
      if (hash(body) !== entry.entryHash) return { valid: false, index: i, reason: 'entry_hash_mismatch' };
    }
    return { valid: true, entries: this.entries.length };
  }

  snapshot() {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
