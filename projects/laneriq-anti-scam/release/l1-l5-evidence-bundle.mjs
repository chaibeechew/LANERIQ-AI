import crypto from "node:crypto";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildL1L5EvidenceBundle({ shippingArtifactSha256, candidateSha, layers, issuedAt = new Date().toISOString() } = {}) {
  if (!/^[0-9a-f]{64}$/i.test(String(shippingArtifactSha256 || ""))) throw new Error("L1_L5_BUNDLE_ARTIFACT_SHA_INVALID");
  if (!/^[0-9a-f]{40}$/i.test(String(candidateSha || ""))) throw new Error("L1_L5_BUNDLE_CANDIDATE_SHA_INVALID");
  if (!Array.isArray(layers) || layers.length !== 5) throw new Error("L1_L5_BUNDLE_REQUIRES_FIVE_LAYERS");
  const expected = ["L1", "L2", "L3", "L4", "L5"];
  for (let i = 0; i < expected.length; i += 1) {
    if (layers[i]?.layer !== expected[i]) throw new Error(`L1_L5_BUNDLE_LAYER_ORDER_INVALID:${expected[i]}`);
  }
  const publicProductionReady = layers.every((layer) => layer.ready === true && layer.verdict === "READY");
  const body = {
    bundleVersion: 1,
    product: "LANERIQ Anti Scam",
    candidateSha: String(candidateSha).toLowerCase(),
    shippingArtifactSha256: String(shippingArtifactSha256).toLowerCase(),
    issuedAt,
    publicProduction: publicProductionReady ? "READY" : "BLOCKED",
    layers: layers.map((layer) => canonicalize(layer)),
    truthBoundary: {
      codeOrCiAloneCannotSetProductionReady: true,
      externalPhysicalDeviceEvidenceRequired: true,
      productionProviderEvidenceRequired: true,
      exactSignedArtifactBindingRequired: true,
      exactMainProductionConvergenceRequired: true,
    },
  };
  const canonical = JSON.stringify(canonicalize(body));
  return Object.freeze({ ...body, bundleSha256: sha256(canonical) });
}

export function verifyL1L5EvidenceBundle(bundle) {
  if (!bundle || typeof bundle !== "object") return Object.freeze({ ok: false, reason: "bundle-invalid" });
  const { bundleSha256, ...body } = bundle;
  if (!/^[0-9a-f]{64}$/i.test(String(bundleSha256 || ""))) return Object.freeze({ ok: false, reason: "bundle-hash-invalid" });
  const actual = sha256(JSON.stringify(canonicalize(body)));
  if (actual !== String(bundleSha256).toLowerCase()) return Object.freeze({ ok: false, reason: "bundle-hash-mismatch" });
  if (!Array.isArray(body.layers) || body.layers.length !== 5) return Object.freeze({ ok: false, reason: "layer-count-invalid" });
  const ready = body.layers.every((layer, index) => layer.layer === `L${index + 1}` && layer.ready === true && layer.verdict === "READY");
  if ((body.publicProduction === "READY") !== ready) return Object.freeze({ ok: false, reason: "production-verdict-mismatch" });
  return Object.freeze({ ok: true, verdict: body.publicProduction, bundleSha256: actual });
}
