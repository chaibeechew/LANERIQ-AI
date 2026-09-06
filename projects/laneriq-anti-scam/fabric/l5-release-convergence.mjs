function isSha(value) { return /^[0-9a-f]{40}$/i.test(String(value || "")); }
function isDigest(value) { return /^[0-9a-f]{64}$/i.test(String(value || "")); }

export class L5ReleaseConvergence {
  constructor() {
    this.state = {
      mainSha: null,
      candidateSha: null,
      productionSha: null,
      artifactSha256: null,
      signedArtifact: false,
      mainProtected: false,
      requiredChecksConfigured: false,
      requiredChecksPassed: false,
      storeDeclarationsFinal: false,
      multiRegionVerified: false,
      loadCostEvidenceVerified: false,
    };
  }

  record(input = {}) {
    const next = { ...this.state, ...input };
    for (const key of ["mainSha", "candidateSha", "productionSha"]) {
      if (next[key] != null && !isSha(next[key])) throw new Error(`INVALID_L5_SHA:${key}`);
      if (next[key]) next[key] = String(next[key]).toLowerCase();
    }
    if (next.artifactSha256 != null && !isDigest(next.artifactSha256)) throw new Error("INVALID_L5_ARTIFACT_SHA256");
    if (next.artifactSha256) next.artifactSha256 = String(next.artifactSha256).toLowerCase();
    this.state = next;
    return this;
  }

  summary() {
    const exactMain = Boolean(this.state.mainSha) && this.state.mainSha === this.state.candidateSha;
    const exactProduction = exactMain && this.state.productionSha === this.state.mainSha;
    const governanceReady = this.state.mainProtected === true && this.state.requiredChecksConfigured === true && this.state.requiredChecksPassed === true;
    const storeReady = this.state.storeDeclarationsFinal === true && this.state.signedArtifact === true && Boolean(this.state.artifactSha256);
    const scaleReady = this.state.multiRegionVerified === true && this.state.loadCostEvidenceVerified === true;
    const ready = exactProduction && governanceReady && storeReady && scaleReady;
    const blockers = [];
    if (!exactMain) blockers.push("exact-main-alignment");
    if (!exactProduction) blockers.push("production-exact-sha");
    if (!this.state.mainProtected) blockers.push("main-branch-protection");
    if (!this.state.requiredChecksConfigured) blockers.push("required-checks-configured");
    if (!this.state.requiredChecksPassed) blockers.push("required-checks-passed");
    if (!this.state.signedArtifact) blockers.push("production-signed-artifact");
    if (!this.state.artifactSha256) blockers.push("artifact-sha256");
    if (!this.state.storeDeclarationsFinal) blockers.push("store-declarations-final");
    if (!this.state.multiRegionVerified) blockers.push("multi-region-evidence");
    if (!this.state.loadCostEvidenceVerified) blockers.push("load-cost-evidence");
    return Object.freeze({
      layer: "L5",
      verdict: ready ? "READY" : "BLOCKED",
      ready,
      exactMain,
      exactProduction,
      governanceReady,
      storeReady,
      scaleReady,
      blockers,
      ...this.state,
      truthBoundary: "L5 READY requires exact candidate=main=Production SHA plus protected-main governance and a production-signed artifact; Preview or unsigned CI artifacts cannot satisfy it.",
    });
  }
}
