import test from "node:test";
import assert from "node:assert/strict";
import { buildL1L5EvidenceBundle, verifyL1L5EvidenceBundle } from "../l1-l5-evidence-bundle.mjs";

function layer(n, ready = true) {
  return Object.freeze({ layer: `L${n}`, verdict: ready ? "READY" : "BLOCKED", ready, evidence: `layer-${n}` });
}

test("L1-L5 bundle binds exact artifact + candidate SHA and verifies hash continuity", () => {
  const bundle = buildL1L5EvidenceBundle({
    shippingArtifactSha256: "a".repeat(64),
    candidateSha: "b".repeat(40),
    layers: [1, 2, 3, 4, 5].map((n) => layer(n)),
    issuedAt: "2026-09-07T00:00:00.000Z",
  });
  assert.equal(bundle.publicProduction, "READY");
  assert.equal(verifyL1L5EvidenceBundle(bundle).ok, true);
});

test("L1-L5 bundle remains BLOCKED when any external layer is blocked", () => {
  const bundle = buildL1L5EvidenceBundle({
    shippingArtifactSha256: "c".repeat(64),
    candidateSha: "d".repeat(40),
    layers: [layer(1), layer(2), layer(3, false), layer(4), layer(5)],
  });
  assert.equal(bundle.publicProduction, "BLOCKED");
  assert.equal(verifyL1L5EvidenceBundle(bundle).verdict, "BLOCKED");
});

test("tampering with a layer invalidates the bundle", () => {
  const bundle = buildL1L5EvidenceBundle({
    shippingArtifactSha256: "e".repeat(64),
    candidateSha: "f".repeat(40),
    layers: [1, 2, 3, 4, 5].map((n) => layer(n)),
  });
  const tampered = { ...bundle, layers: bundle.layers.map((x, i) => i === 1 ? { ...x, ready: false } : x) };
  const result = verifyL1L5EvidenceBundle(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "bundle-hash-mismatch");
});
