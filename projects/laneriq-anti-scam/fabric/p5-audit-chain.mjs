import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function entryBody(entry, previousHash) {
  return JSON.stringify({
    index: entry.index,
    previousHash,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    metadata: entry.metadata,
  });
}

export function verifyAuditEntries(entries = []) {
  if (!Array.isArray(entries)) return { valid: false, index: -1, reason: 'entries_not_array' };
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || entry.index !== i) return { valid: false, index: i, reason: 'index_mismatch' };
    const previousHash = i === 0 ? 'GENESIS' : entries[i - 1].entryHash;
    if (entry.previousHash !== previousHash) return { valid: false, index: i, reason: 'previous_hash_mismatch' };
    if (hash(entryBody(entry, previousHash)) !== entry.entryHash) {
      return { valid: false, index: i, reason: 'entry_hash_mismatch' };
    }
  }
  return { valid: true, entries: entries.length };
}

export class AuditChain {
  constructor() {
    this.entries = [];
  }

  append({ actor = 'system', action, target = '', metadata = {} } = {}) {
    if (typeof action !== 'string' || action.trim() === '') throw new Error('action required');
    const previousHash = this.entries.length ? this.entries[this.entries.length - 1].entryHash : 'GENESIS';
    const base = {
      index: this.entries.length,
      previousHash,
      actor: String(actor),
      action: action.trim(),
      target: String(target),
      metadata,
    };
    const entry = Object.freeze({ ...base, entryHash: hash(entryBody(base, previousHash)) });
    this.entries.push(entry);
    return entry;
  }

  verify() {
    return verifyAuditEntries(this.entries);
  }

  snapshot() {
    return this.entries.map((entry) => ({ ...entry, metadata: structuredClone(entry.metadata) }));
  }
}
