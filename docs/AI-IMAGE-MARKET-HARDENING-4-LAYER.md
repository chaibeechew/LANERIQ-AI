# LANERIQ AI — AI Image Market Hardening 4-Layer Closure

Base: `c4b031c048cde21d35c6b03ae0e7c68c4befb0e3`

This batch closes the code-side gap between the already integrated Creative Media Image 5-layer intelligence engine and the customer-facing `/api/images/generate` route. It does **not** claim that external live evidence exists merely because the code path is present.

## Layer 1 — Production Runtime Wiring

- `/api/images/generate` can route eligible provider generation through `runMarketHardenedImageGeneration`.
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

Commercial live-provider closure additionally requires at least **20 real verified outputs**, an aggregate verified quality score of at least **88**, and a Production evidence id. Provider self-report alone never closes this gate.

## Layer 3 — Commercial Reliability Gate

`getImageMarketRuntimeReadiness()` requires live evidence before it can report commercial reliability:

- at least **100 measured samples**;
- success rate at least **98%**;
- measured p95 latency greater than zero and no higher than **45 seconds**;
- refund failure rate exactly **0**;
- idempotent replay verified;
- rate-limit / abuse-pressure behavior verified;
- provider failover verified whenever an alternate eligible provider exists;
- refund evidence verified.

These values are evidence inputs. CI contract tests verify the fail-closed logic; they are not themselves live evidence.

## Layer 4 — Market Release Gate

`marketReady=true` additionally requires:

- `IMAGE_MARKET_HARDENING_MODE=enforce`;
- hardened execution ready;
- live provider proof;
- commercial reliability proof;
- authenticated Production E2E evidence id;
- SHA-256 release evidence digest;
- browser verification;
- real mobile verification;
- image abuse/safety suite pass;
- monitoring/alerting readiness;
- GitHub main exact SHA equals the Production runtime exact SHA;
- explicit market release approval.

The final live gate is:

```bash
node scripts/image-market-release-gate.mjs
```

The public-safe diagnostic surface is:

```text
GET /api/images/market-readiness
```

It exposes booleans, counts, quality/reliability/release state, evidence ids/hashes and blockers only. It never exposes provider tokens, observer tokens or signing secrets.

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
IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT=<>=20 real outputs>
IMAGE_GENERATION_VERIFIED_QUALITY_SCORE=<>=88>
IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID=<evidence id>

IMAGE_QUALITY_OBSERVER_ENDPOINT=<approved https endpoint>
IMAGE_QUALITY_OBSERVER_TOKEN=<secret>
IMAGE_QUALITY_OBSERVER_SIGNING_SECRET=<>=32 char secret>
IMAGE_QUALITY_OBSERVER_KIND=laneriq-vision
IMAGE_QUALITY_OBSERVER_ID=<exact trusted observer id>

IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE=<>=100>
IMAGE_MARKET_RELIABILITY_SUCCESS_RATE=<>=0.98>
IMAGE_MARKET_RELIABILITY_P95_MS=<1..45000>
IMAGE_MARKET_REFUND_FAILURE_RATE=0
IMAGE_MARKET_IDEMPOTENCY_VERIFIED=true
IMAGE_MARKET_RATE_LIMIT_VERIFIED=true
IMAGE_MARKET_ALTERNATE_PROVIDER_AVAILABLE=<true|false>
IMAGE_MARKET_PROVIDER_FAILOVER_VERIFIED=true   # required when alternate provider exists
IMAGE_MARKET_REFUND_EVIDENCE_VERIFIED=true

IMAGE_MARKET_E2E_EVIDENCE_ID=<production e2e evidence id>
IMAGE_MARKET_RELEASE_EVIDENCE_SHA256=<64 hex digest>
IMAGE_MARKET_BROWSER_VERIFIED=true
IMAGE_MARKET_MOBILE_VERIFIED=true
IMAGE_MARKET_ABUSE_SUITE_PASSED=true
IMAGE_MARKET_MONITORING_READY=true
IMAGE_MARKET_MAIN_SHA=<exact main commit sha>
IMAGE_MARKET_PRODUCTION_SHA=<exact Production runtime commit sha>
IMAGE_MARKET_RELEASE_APPROVED=true
```

## Truth boundary

After this batch is merged and CI passes, the correct claim is **AI Image commercial hardening code complete / live evidence pending** until a real Production provider and observer have produced the required output, quality, reliability, refund, browser/mobile, abuse/monitoring, authenticated E2E and exact-SHA evidence. Only a passing `image-market-release-gate.mjs` against the Production evidence environment permits the stronger **AI Image Market Sales Ready / Production Live Verified** claim.
