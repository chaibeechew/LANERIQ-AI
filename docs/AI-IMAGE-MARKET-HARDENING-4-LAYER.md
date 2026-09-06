# LANERIQ AI — AI Image Market Hardening 4-Layer Closure

Base: `c4b031c048cde21d35c6b03ae0e7c68c4befb0e3`

This batch closes the code-side gap between the already integrated Creative Media Image 5-layer intelligence engine and the customer-facing `/api/images/generate` route. It does **not** claim that external live evidence exists merely because the code path is present.

## Layer 1 — Production Runtime Wiring

- `/api/images/generate` can now route eligible provider generation through `runMarketHardenedImageGeneration`.
- The hardened route invokes the existing Creative Media 5-layer engine rather than bypassing it.
- `IMAGE_MARKET_HARDENING_MODE=enforce` is fail-closed. If the provider, safety declaration, capability or trusted observer is not ready, no unjudged provider output is released; the existing zero-cost local fallback remains clearly labelled.
- Provider output still goes through private durable Asset Library capture before being returned.

## Layer 2 — Real Provider + Real Output Evidence

A candidate must pass all of these before the hardened path can return it:

- actual provider execution;
- byte-level PNG/JPEG/WebP validation;
- approved output host policy;
- locally computed SHA-256 artifact hash;
- provider-reported artifact hash equality when present;
- independent observer quality signals;
- safety pass;
- provenance verification;
- HMAC-SHA256 observer signature verification bound to request id, artifact hash, observation hash, observer kind and observer id;
- existing Creative Media acceptance threshold and continuity rules.

The observer endpoint is trusted only when it is configured with a token, a signing secret of at least 32 characters, a trusted observer kind and an exact observer id.

## Layer 3 — Commercial Reliability Gate

`getImageMarketRuntimeReadiness()` requires live evidence before it can report commercial reliability:

- at least 100 measured samples;
- success rate at least 98%;
- measured p95 latency greater than zero and no higher than the image generation timeout;
- at least one verified real provider output plus a Production evidence id;
- refund evidence verified.

These values are evidence inputs. CI contract tests verify the fail-closed logic; they are not themselves live evidence.

## Layer 4 — Market Release Gate

`marketReady=true` additionally requires:

- `IMAGE_MARKET_HARDENING_MODE=enforce`;
- hardened execution ready;
- live provider proof;
- commercial reliability proof;
- refund proof;
- Production E2E evidence id;
- SHA-256 release evidence digest;
- explicit market release approval.

The final live gate is:

```bash
node scripts/image-market-release-gate.mjs
```

The public-safe diagnostic surface is:

```text
GET /api/images/market-readiness
```

It exposes booleans, counts, evidence ids/hashes and blockers only. It never exposes provider tokens, observer tokens or signing secrets.

## CI

`.github/workflows/image-market-hardening.yml` runs:

1. `scripts/image-market-hardening-contract-tests.mjs`
2. existing Creative Media Image 5-layer / Video 6-layer regression
3. existing Image Studio regression

## Required Production environment evidence

```text
IMAGE_MARKET_HARDENING_MODE=enforce
IMAGE_GENERATION_PROVIDER=<provider id>
IMAGE_GENERATION_ENDPOINT=<approved https endpoint>
IMAGE_GENERATION_TOKEN=<secret>
IMAGE_GENERATION_COST_CLASS=<zero|free|metered>
IMAGE_GENERATION_CAPABILITIES=text-to-image,...
IMAGE_GENERATION_SAFETY_READY=true
IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT=<real count>
IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID=<evidence id>

IMAGE_QUALITY_OBSERVER_ENDPOINT=<approved https endpoint>
IMAGE_QUALITY_OBSERVER_TOKEN=<secret>
IMAGE_QUALITY_OBSERVER_SIGNING_SECRET=<>=32 char secret>
IMAGE_QUALITY_OBSERVER_KIND=laneriq-vision
IMAGE_QUALITY_OBSERVER_ID=<exact trusted observer id>

IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE=<>=100>
IMAGE_MARKET_RELIABILITY_SUCCESS_RATE=<>=0.98>
IMAGE_MARKET_RELIABILITY_P95_MS=<1..45000>
IMAGE_MARKET_REFUND_EVIDENCE_VERIFIED=true
IMAGE_MARKET_E2E_EVIDENCE_ID=<production e2e evidence id>
IMAGE_MARKET_RELEASE_EVIDENCE_SHA256=<64 hex digest>
IMAGE_MARKET_RELEASE_APPROVED=true
```

## Truth boundary

After this batch is merged and CI passes, the correct claim is **AI Image commercial hardening code complete / live evidence pending** until a real Production provider and observer have produced the required sample, reliability, refund and E2E evidence. Only a passing `image-market-release-gate.mjs` against the Production evidence environment permits the stronger **AI Image Market Ready** claim.
