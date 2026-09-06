import crypto from 'node:crypto';

const SHA256 = /^[0-9a-f]{64}$/i;

export class EvidenceFreshnessReplayGuard {
  constructor({ maxAgeMs = 15 * 60_000, maxFutureSkewMs = 120_000 } = {}) {
    this.maxAgeMs = maxAgeMs;
    this.maxFutureSkewMs = maxFutureSkewMs;
    this.seen = new Set();
  }

  fingerprint(evidence) {
    const material = [
      evidence?.issuer || '', evidence?.subject || '', evidence?.nonce || '',
      evidence?.artifactSha256 || '', evidence?.issuedAt || '', evidence?.expiresAt || ''
    ].join('\n');
    return crypto.createHash('sha256').update(material).digest('hex');
  }

  verify(evidence, now = Date.now()) {
    const issuedAt = Date.parse(String(evidence?.issuedAt || ''));
    const expiresAt = Date.parse(String(evidence?.expiresAt || ''));
    const artifactSha256 = String(evidence?.artifactSha256 || '');
    if (!evidence?.issuer || !evidence?.subject || !evidence?.nonce) return { ok:false, code:'IDENTITY_MISSING' };
    if (!SHA256.test(artifactSha256)) return { ok:false, code:'ARTIFACT_SHA_INVALID' };
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) return { ok:false, code:'TIME_WINDOW_INVALID' };
    if (issuedAt - now > this.maxFutureSkewMs) return { ok:false, code:'EVIDENCE_FROM_FUTURE' };
    if (now - issuedAt > this.maxAgeMs) return { ok:false, code:'EVIDENCE_STALE' };
    if (now >= expiresAt) return { ok:false, code:'EVIDENCE_EXPIRED' };
    const fp = this.fingerprint(evidence);
    if (this.seen.has(fp)) return { ok:false, code:'EVIDENCE_REPLAY' };
    this.seen.add(fp);
    return { ok:true, code:'ACCEPTED', fingerprint:fp };
  }
}
