import { requireNonEmpty } from './contracts.mjs';
import { verifyEd25519Policy } from './p5-policy-signature.mjs';

const DEFAULT_STAGES = Object.freeze([0.01, 0.05, 0.25, 0.50, 1.0]);

export class RolloutController {
  constructor({ stages = DEFAULT_STAGES, maxCrashRate = 0.005, maxFalsePositiveRate = 0.001 } = {}) {
    if (!Array.isArray(stages) || stages.length === 0) throw new Error('stages required');
    this.stages = stages.map(Number).filter((n) => n > 0 && n <= 1).sort((a, b) => a - b);
    if (this.stages.length === 0) throw new Error('valid rollout stages required');
    this.maxCrashRate = maxCrashRate;
    this.maxFalsePositiveRate = maxFalsePositiveRate;
    this.policies = new Map();
  }

  createSignedPolicy({ id, version, payload, publicKeyPem, signatureBase64 } = {}) {
    const signatureVerified = verifyEd25519Policy({ payload, publicKeyPem, signatureBase64 });
    return this.createPolicy({ id, version, signatureVerified, policyDigestSource: payload });
  }

  createPolicy({ id, version, signatureVerified = false, policyDigestSource = null } = {}) {
    id = requireNonEmpty(id, 'id');
    version = requireNonEmpty(version, 'version');
    if (!signatureVerified) throw new Error('unsigned policy rejected');
    const state = {
      id,
      version,
      stageIndex: 0,
      enabled: true,
      killed: false,
      rollbackVersion: null,
      policyDigestSource,
      evidence: [],
    };
    this.policies.set(id, state);
    return this.snapshot(id);
  }

  evaluate(id, evidence = {}) {
    const p = this.#get(id);
    const crashRate = Number(evidence.crashRate);
    const falsePositiveRate = Number(evidence.falsePositiveRate);
    const sampleSize = Number(evidence.sampleSize);
    const healthy = Number.isFinite(crashRate) && Number.isFinite(falsePositiveRate) && Number.isFinite(sampleSize) && sampleSize > 0 &&
      crashRate >= 0 && falsePositiveRate >= 0 &&
      crashRate <= this.maxCrashRate && falsePositiveRate <= this.maxFalsePositiveRate;
    const record = { crashRate, falsePositiveRate, sampleSize, healthy, atMs: Date.now() };
    p.evidence.push(record);
    if (!healthy) return { action: 'HOLD', reason: 'quality_gate_failed', ...this.snapshot(id) };
    return { action: 'PROMOTION_ELIGIBLE', reason: 'quality_gate_passed', ...this.snapshot(id) };
  }

  promote(id) {
    const p = this.#get(id);
    if (p.killed || !p.enabled) return { promoted: false, reason: 'policy_disabled', ...this.snapshot(id) };
    const latest = p.evidence[p.evidence.length - 1];
    if (!latest?.healthy) return { promoted: false, reason: 'missing_healthy_evidence', ...this.snapshot(id) };
    if (p.stageIndex >= this.stages.length - 1) return { promoted: false, reason: 'already_global', ...this.snapshot(id) };
    p.stageIndex += 1;
    return { promoted: true, reason: 'advanced_one_stage', ...this.snapshot(id) };
  }

  kill(id, rollbackVersion = null) {
    const p = this.#get(id);
    p.killed = true;
    p.enabled = false;
    p.rollbackVersion = rollbackVersion;
    return this.snapshot(id);
  }

  snapshot(id) {
    const p = this.#get(id);
    return {
      id: p.id,
      version: p.version,
      rolloutFraction: this.stages[p.stageIndex],
      enabled: p.enabled,
      killed: p.killed,
      rollbackVersion: p.rollbackVersion,
      evidenceCount: p.evidence.length,
    };
  }

  #get(id) {
    const p = this.policies.get(id);
    if (!p) throw new Error('unknown rollout policy');
    return p;
  }
}
