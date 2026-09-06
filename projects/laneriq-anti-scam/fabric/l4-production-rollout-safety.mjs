import crypto from "node:crypto";

const VALID_PHASES = new Set(["IDLE", "CANARY", "EXPANDING", "ROLLED_BACK", "KILLED", "STABLE"]);

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export class L4ProductionRolloutSafety {
  constructor() {
    this.phase = "IDLE";
    this.killSwitchArmed = false;
    this.rollbackVerified = false;
    this.immutableAuditVerified = false;
    this.keyCustodyVerified = false;
    this.regionalPrivacyVerified = false;
    this.entries = [];
  }

  configure({ killSwitchArmed = false, keyCustodyVerified = false, regionalPrivacyVerified = false } = {}) {
    this.killSwitchArmed = killSwitchArmed === true;
    this.keyCustodyVerified = keyCustodyVerified === true;
    this.regionalPrivacyVerified = regionalPrivacyVerified === true;
    return this;
  }

  transition(next, { approved = false, reason = "" } = {}) {
    if (!VALID_PHASES.has(next)) throw new Error(`INVALID_L4_PHASE:${next}`);
    if (!approved) throw new Error("L4_ROLLOUT_APPROVAL_REQUIRED");
    if (["CANARY", "EXPANDING", "STABLE"].includes(next) && !this.killSwitchArmed) throw new Error("L4_KILL_SWITCH_NOT_ARMED");
    if (next === "EXPANDING" && this.phase !== "CANARY") throw new Error("L4_EXPANSION_REQUIRES_CANARY");
    if (next === "STABLE" && !["CANARY", "EXPANDING"].includes(this.phase)) throw new Error("L4_STABLE_REQUIRES_OBSERVED_ROLLOUT");
    const previous = this.entries.at(-1)?.entryHash || "0".repeat(64);
    const material = JSON.stringify({ sequence: this.entries.length + 1, from: this.phase, to: next, reason: String(reason), previous });
    const entryHash = hash(material);
    this.entries.push(Object.freeze({ sequence: this.entries.length + 1, from: this.phase, to: next, reason: String(reason), previousHash: previous, entryHash }));
    this.phase = next;
    if (next === "ROLLED_BACK") this.rollbackVerified = true;
    return this;
  }

  verifyImmutableAudit() {
    let previous = "0".repeat(64);
    for (const entry of this.entries) {
      if (entry.previousHash !== previous) return false;
      const material = JSON.stringify({ sequence: entry.sequence, from: entry.from, to: entry.to, reason: entry.reason, previous });
      if (hash(material) !== entry.entryHash) return false;
      previous = entry.entryHash;
    }
    this.immutableAuditVerified = this.entries.length > 0;
    return this.immutableAuditVerified;
  }

  summary() {
    const ready = this.phase === "STABLE" && this.killSwitchArmed && this.rollbackVerified && this.immutableAuditVerified && this.keyCustodyVerified && this.regionalPrivacyVerified;
    return Object.freeze({
      layer: "L4",
      verdict: ready ? "READY" : "BLOCKED",
      ready,
      phase: this.phase,
      killSwitchArmed: this.killSwitchArmed,
      rollbackVerified: this.rollbackVerified,
      immutableAuditVerified: this.immutableAuditVerified,
      keyCustodyVerified: this.keyCustodyVerified,
      regionalPrivacyVerified: this.regionalPrivacyVerified,
      auditEntries: this.entries.length,
      truthBoundary: "L4 READY requires observed canary/rollback capability, controlled key custody, regional privacy controls and verified audit continuity; code presence alone is insufficient.",
    });
  }
}
