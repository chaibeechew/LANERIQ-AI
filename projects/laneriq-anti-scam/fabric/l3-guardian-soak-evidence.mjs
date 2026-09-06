const REQUIRED_EVENTS = Object.freeze([
  "process-kill-recovery",
  "reboot-recovery",
  "package-update-recovery",
  "notification-integrity",
  "background-restriction-truth",
  "battery-thermal-observation",
  "app-builder-witness-coexistence",
]);

export class L3GuardianSoakEvidence {
  constructor({ minSoakHours = 24, minOemCount = 3 } = {}) {
    this.minSoakHours = minSoakHours;
    this.minOemCount = minOemCount;
    this.soakHours = 0;
    this.oems = new Set();
    this.events = new Map();
    this.forceStopTruthObserved = false;
    this.signedEvidence = false;
  }

  recordSoak({ hours, oems = [], signedEvidence = false } = {}) {
    const n = Number(hours);
    if (!Number.isFinite(n) || n < 0) throw new Error("INVALID_L3_SOAK_HOURS");
    this.soakHours = n;
    for (const oem of oems) if (String(oem || "").trim()) this.oems.add(String(oem).trim().toLowerCase());
    this.signedEvidence = signedEvidence === true;
    return this;
  }

  recordEvent(name, { passed = false, physicalDevice = false } = {}) {
    if (!REQUIRED_EVENTS.includes(name)) throw new Error(`UNKNOWN_L3_EVENT:${name}`);
    this.events.set(name, Object.freeze({ passed: passed === true, physicalDevice: physicalDevice === true }));
    return this;
  }

  recordForceStopTruth({ observed = false } = {}) {
    this.forceStopTruthObserved = observed === true;
    return this;
  }

  summary() {
    const missing = REQUIRED_EVENTS.filter((name) => !this.events.has(name));
    const failed = REQUIRED_EVENTS.filter((name) => this.events.has(name) && this.events.get(name).passed !== true);
    const nonPhysical = REQUIRED_EVENTS.filter((name) => this.events.has(name) && this.events.get(name).physicalDevice !== true);
    const soakReady = this.soakHours >= this.minSoakHours;
    const oemReady = this.oems.size >= this.minOemCount;
    const ready = soakReady && oemReady && missing.length === 0 && failed.length === 0 && nonPhysical.length === 0 && this.forceStopTruthObserved && this.signedEvidence;
    return Object.freeze({
      layer: "L3",
      verdict: ready ? "READY" : "BLOCKED",
      ready,
      soakHours: this.soakHours,
      minSoakHours: this.minSoakHours,
      oemCount: this.oems.size,
      minOemCount: this.minOemCount,
      missing,
      failed,
      nonPhysicalEvidence: nonPhysical,
      forceStopTruthObserved: this.forceStopTruthObserved,
      signedEvidence: this.signedEvidence,
      truthBoundary: "Android Force Stop can prevent ordinary app self-restart; L3 records that platform truth instead of claiming impossible persistence.",
    });
  }
}

export { REQUIRED_EVENTS };
