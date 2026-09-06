# LANERIQ AI — AI Image Market Sales Gate

## Purpose
This gate closes the gap between AI Image code readiness and truthful market-sale readiness. It never converts simulated, configured, CI-only, Preview-only, unsigned, provider-self-reported or stale-deployment evidence into LIVE VERIFIED status.

## Layer 1 — Production runtime wiring — ✅ CODE / CI CLOSED
The customer Production route now enforces:
- `/api/images/generate` uses the hardened creative-media execution path for provider-backed generation.
- Provider HTTPS output is server-captured and byte-validated before observation.
- Independent observer evidence must cover the same captured SHA-256 bytes.
- Observer identity, request binding, observation digest and HMAC signature must verify.
- Real-output quality failure is fail-closed for model claims.
- Atomic credit charge/refund remains intact.
- Accepted provider output is durably captured in the owner's private Asset Library before release.
- Legacy provider results without the hardened evidence are not re-released as verified model output.
- Provider capture and observer timeouts remain active until their response bodies are fully read.

Validated code-head evidence earlier on PR #392 included the dedicated AI Image Market Readiness Gate, Creative Media Image 5-layer contract, Image Studio regression, Runtime Reliability, Non-production 100, Structural 100 and Next.js Production Build.

## Layer 2 — Real provider and output proof — ✅ CODE CLOSED / ⏳ LIVE EVIDENCE REQUIRED
Commercial proof is now evidence-bearing rather than boolean-only:
- At least 20 real `REAL_OUTPUT_QUALITY_VERIFIED` outputs are required.
- Aggregate measured quality must be at least 88.
- Every counted output must have safety, provenance and output validation PASS.
- Every counted output must be independently observed with signed evidence.
- Observer evidence must bind to the exact server-captured provider bytes.
- Provider self-report is rejected from the verified output count.
- Raw output evidence is aggregated into an evidence SHA-256.
- The complete market evidence bundle is HMAC-SHA256 signed; tampering invalidates the bundle.
- Production runtime also rechecks that the provider is configured, provider safety is ready and a trusted observer is connected before Layer 2 can pass.

Implementation surfaces:
- `lib/ai/image-market-readiness.js`
- `lib/ai/image-market-runtime.js`
- `scripts/image-market-evidence-bundle.mjs`
- `scripts/ai-image-live-evidence-contract-tests.mjs`
- `scripts/ai-image-evidence-bundle-contract-tests.mjs`
- `/api/images/market-readiness`

## Layer 3 — Commercial reliability — ✅ CODE CLOSED / ⏳ REAL SAMPLE REQUIRED
The commercial gate now requires measured evidence from at least 100 valid runtime samples:
- sample size >= 100;
- success rate >= 98%;
- p95 generation latency <= 45 seconds and greater than zero;
- refund failure rate = 0 for failed charged generations;
- refund evidence verified;
- idempotent replay verified;
- rate-limit behavior verified;
- abuse-pressure behavior verified;
- provider failover verified only when an alternate eligible provider actually exists.

`/api/images/generate` emits privacy-safe `AI_IMAGE_MARKET_EVENT` telemetry for hardened success, hardened failure/refund and idempotent replay. The telemetry contains a hashed operation id, timings, result/evidence digests and deployment identity; it does not log prompts, image contents or raw user identity. Raw samples are aggregated into the signed evidence bundle instead of manually entering headline metrics.

## Layer 4 — Market release — ✅ CODE CLOSED / ⏳ PRODUCTION CLOSURE REQUIRED
Market release now requires all of the following together:
- authenticated Production Generate → hardened validation → durable Save → Preview/Asset Library E2E;
- opaque E2E evidence id plus release evidence SHA-256;
- browser verification;
- real mobile verification;
- image abuse/safety suite PASS;
- monitoring/alerting ready;
- explicit market release approval;
- runtime must actually be Vercel `production` on Git ref `main`;
- exact 40-character GitHub main SHA = exact Production runtime SHA.

The external read-only verifier `scripts/image-market-production-verify.mjs` re-reads both `/api/images/market-readiness` and `/api/images/readiness` from the canonical Production URL and rejects stale deployments, Preview deployments, unsigned bundles or SHA drift. `.github/workflows/ai-image-production-release-verify.yml` is manual-only, main-only and performs no paid generation.

## Current observed LIVE state — 2026-09-06
Connected Vercel inspection of the canonical `laneriq-ai.vercel.app` Production deployment showed:
- deployment: `dpl_5nTr8xXJ8SYnWCYe1mKXHBxX2D72`;
- Git ref: `main`;
- Production SHA: `c4b031c048cde21d35c6b03ae0e7c68c4befb0e3`;
- deployment state: READY / target `production`;
- live `/api/images/readiness`: `externalProviderConnected:false`, `externalProviderAllowed:false`.

Therefore Layer 2 cannot truthfully close LIVE yet, and Layer 4 cannot close against the feature-branch implementation. This is an external evidence/configuration blocker, not a reason to weaken the gate.

## Consolidation / merge discipline
PR #392 is the consolidated AI Image commercial closure path. It incorporates the stricter signed-output/reliability/release evidence concepts that overlapped with PR #391. Production Release Control should reconcile/close the overlapping PR rather than merge both independently as unrelated changes. After any merge, re-align to latest main, rerun CI, deploy exact main, then run the read-only Production verifier.

## Release truth
Only when all four layers pass may AI Image be labelled `MARKET_SALES_READY` / `PRODUCTION_LIVE_VERIFIED`.

Until then the correct state is `HOLD` / `EVIDENCE_REQUIRED`, even when all code and CI contracts pass. The current Production observation remains HOLD because the external image provider is not connected and the new closure code is not yet the exact Production main deployment.
