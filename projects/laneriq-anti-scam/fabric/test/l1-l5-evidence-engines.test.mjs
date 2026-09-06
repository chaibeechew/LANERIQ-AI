import test from "node:test";
import assert from "node:assert/strict";
import { L1NetworkEvidenceMatrix, REQUIRED_NETWORK_CASES } from "../l1-network-evidence-matrix.mjs";
import { L2MalwareBenchmarkEvidence } from "../l2-malware-benchmark-evidence.mjs";
import { L3GuardianSoakEvidence, REQUIRED_EVENTS } from "../l3-guardian-soak-evidence.mjs";
import { L4ProductionRolloutSafety } from "../l4-production-rollout-safety.mjs";
import { L5ReleaseConvergence } from "../l5-release-convergence.mjs";

test("L1 stays blocked for synthetic or unsigned evidence", () => {
  const matrix = new L1NetworkEvidenceMatrix();
  for (const name of REQUIRED_NETWORK_CASES) matrix.recordCase(name, { passed: true, physicalDevice: false });
  matrix.recordFalsePositiveBenchmark({ falsePositiveRate: 0, signedArtifactSha256: "a".repeat(64), deviceEvidenceSigned: false });
  assert.equal(matrix.summary().ready, false);
  assert.equal(matrix.summary().nonPhysicalEvidence.length, REQUIRED_NETWORK_CASES.length);
});

test("L1 can become ready only with complete physical-device exact-artifact evidence", () => {
  const matrix = new L1NetworkEvidenceMatrix();
  for (const name of REQUIRED_NETWORK_CASES) matrix.recordCase(name, { passed: true, physicalDevice: true, observedAt: new Date().toISOString(), deviceModel: "test-device", androidApi: 36 });
  matrix.recordFalsePositiveBenchmark({ falsePositiveRate: 0.0005, signedArtifactSha256: "a".repeat(64), deviceEvidenceSigned: true });
  assert.equal(matrix.summary().verdict, "READY");
});

test("L2 rejects small or high-false-positive benchmark claims", () => {
  const evidence = new L2MalwareBenchmarkEvidence();
  evidence.record({ malicious: 20, maliciousDetected: 20, benign: 20, benignFlagged: 2, providerLiveVerified: true, sandboxLiveVerified: true, signedCorpusEvidence: true });
  assert.equal(evidence.summary().ready, false);
});

test("L2 requires live provider + sandbox + signed efficacy corpus", () => {
  const evidence = new L2MalwareBenchmarkEvidence();
  evidence.record({ malicious: 1000, maliciousDetected: 970, benign: 5000, benignFlagged: 3, providerLiveVerified: true, sandboxLiveVerified: true, signedCorpusEvidence: true });
  assert.equal(evidence.summary().verdict, "READY");
});

test("L3 requires 24h, OEM breadth, physical events and Force Stop truth", () => {
  const evidence = new L3GuardianSoakEvidence();
  evidence.recordSoak({ hours: 24, oems: ["Google", "Samsung", "Xiaomi"], signedEvidence: true });
  for (const name of REQUIRED_EVENTS) evidence.recordEvent(name, { passed: true, physicalDevice: true });
  assert.equal(evidence.summary().ready, false);
  evidence.recordForceStopTruth({ observed: true });
  assert.equal(evidence.summary().verdict, "READY");
});

test("L4 blocks rollout without an armed kill switch and verifies hash continuity", () => {
  const safety = new L4ProductionRolloutSafety();
  assert.throws(() => safety.transition("CANARY", { approved: true }), /L4_KILL_SWITCH_NOT_ARMED/);
  safety.configure({ killSwitchArmed: true, keyCustodyVerified: true, regionalPrivacyVerified: true });
  safety.transition("CANARY", { approved: true, reason: "1-percent" });
  safety.transition("ROLLED_BACK", { approved: true, reason: "rollback-drill" });
  safety.transition("CANARY", { approved: true, reason: "retry" });
  safety.transition("EXPANDING", { approved: true, reason: "healthy" });
  safety.transition("STABLE", { approved: true, reason: "observed" });
  assert.equal(safety.verifyImmutableAudit(), true);
  assert.equal(safety.summary().verdict, "READY");
});

test("L5 remains blocked until exact SHA, governance, signed artifact and scale evidence converge", () => {
  const release = new L5ReleaseConvergence();
  const sha = "b".repeat(40);
  release.record({ mainSha: sha, candidateSha: sha, productionSha: sha, artifactSha256: "c".repeat(64), signedArtifact: true, mainProtected: true, requiredChecksConfigured: true, requiredChecksPassed: true, storeDeclarationsFinal: true, multiRegionVerified: true, loadCostEvidenceVerified: true });
  assert.equal(release.summary().verdict, "READY");
  release.record({ productionSha: "d".repeat(40) });
  assert.equal(release.summary().ready, false);
  assert.ok(release.summary().blockers.includes("production-exact-sha"));
});
