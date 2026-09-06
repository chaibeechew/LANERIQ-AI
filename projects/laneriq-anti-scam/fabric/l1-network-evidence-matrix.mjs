const REQUIRED_NETWORK_CASES = Object.freeze([
  "vpn-consent",
  "ipv4-dns",
  "ipv6-dns",
  "wifi-to-cellular-handoff",
  "cellular-to-wifi-handoff",
  "vpn-conflict",
  "sleep-resume",
  "network-loss-recovery",
]);

function boundedRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export class L1NetworkEvidenceMatrix {
  constructor({ maxFalsePositiveRate = 0.001 } = {}) {
    this.maxFalsePositiveRate = maxFalsePositiveRate;
    this.cases = new Map();
    this.falsePositiveRate = null;
    this.signedArtifactSha256 = null;
    this.deviceEvidenceSigned = false;
  }

  recordCase(name, evidence = {}) {
    if (!REQUIRED_NETWORK_CASES.includes(name)) throw new Error(`UNKNOWN_L1_NETWORK_CASE:${name}`);
    this.cases.set(name, Object.freeze({
      passed: evidence.passed === true,
      physicalDevice: evidence.physicalDevice === true,
      observedAt: String(evidence.observedAt || ""),
      deviceModel: String(evidence.deviceModel || ""),
      androidApi: Number(evidence.androidApi || 0),
    }));
    return this;
  }

  recordFalsePositiveBenchmark({ falsePositiveRate, signedArtifactSha256, deviceEvidenceSigned = false } = {}) {
    this.falsePositiveRate = boundedRate(falsePositiveRate);
    this.signedArtifactSha256 = /^[0-9a-f]{64}$/i.test(String(signedArtifactSha256 || ""))
      ? String(signedArtifactSha256).toLowerCase()
      : null;
    this.deviceEvidenceSigned = deviceEvidenceSigned === true;
    return this;
  }

  summary() {
    const missing = REQUIRED_NETWORK_CASES.filter((name) => !this.cases.has(name));
    const failed = REQUIRED_NETWORK_CASES.filter((name) => this.cases.has(name) && this.cases.get(name).passed !== true);
    const synthetic = REQUIRED_NETWORK_CASES.filter((name) => this.cases.has(name) && this.cases.get(name).physicalDevice !== true);
    const falsePositiveReady = this.falsePositiveRate !== null && this.falsePositiveRate <= this.maxFalsePositiveRate;
    const ready = missing.length === 0 && failed.length === 0 && synthetic.length === 0 &&
      falsePositiveReady && Boolean(this.signedArtifactSha256) && this.deviceEvidenceSigned;
    return Object.freeze({
      layer: "L1",
      verdict: ready ? "READY" : "BLOCKED",
      ready,
      missing,
      failed,
      nonPhysicalEvidence: synthetic,
      falsePositiveRate: this.falsePositiveRate,
      maxFalsePositiveRate: this.maxFalsePositiveRate,
      signedArtifactBound: Boolean(this.signedArtifactSha256),
      deviceEvidenceSigned: this.deviceEvidenceSigned,
      truthBoundary: "L1 READY requires physical-device observations bound to the exact signed artifact; code/CI simulation alone cannot satisfy it.",
    });
  }
}

export { REQUIRED_NETWORK_CASES };
