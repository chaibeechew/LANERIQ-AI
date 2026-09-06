# LANERIQ AI — AI Image Market Sales Gate

## Purpose
This gate closes the gap between AI Image code readiness and truthful market-sale readiness. It never converts simulated, configured, CI-only, or provider-self-reported evidence into LIVE VERIFIED status.

## Layer 1 — Production runtime wiring — ✅ CODE / CI CLOSED
The Production route now enforces:
- `/api/images/generate` uses the hardened creative-media execution path for provider-backed generation.
- Provider HTTPS output is server-captured and byte-validated before observation.
- Independent observer evidence must cover the same captured SHA-256 bytes.
- Observer identity, request binding, observation digest and HMAC signature must verify.
- Real-output quality failure is fail-closed for model claims.
- Atomic credit charge/refund remains intact.
- Accepted provider output is durably captured in the owner's private Asset Library before release.
- Legacy provider results without the new hardened evidence are not re-released as verified model output.
- Provider capture and observer timeouts remain active until their response bodies are fully read.

Validated code-head evidence on PR #392:
- Dedicated `LANERIQ AI Image Market Readiness Gate`: PASS.
- Creative Media Image 5-layer contract: PASS.
- Image Studio regression contract: PASS.
- Main `LANERIQ AI 100 CI`: Image Studio, Runtime Reliability, Non-production 100, Structural 100 and Next.js Production Build: PASS.

**Truth boundary:** Layer 1 is CODE/CI verified. Documentation-only follow-up commits do not upgrade it to LIVE VERIFIED. Layer 2 still requires real provider outputs and real independent observations.

## Layer 2 — Real provider and output proof
Required:
- Approved provider is connected and has real verified outputs.
- At least 20 real outputs are observed before commercial closure.
- Aggregate measured quality score is at least 88.
- Safety, provenance and output validation pass on accepted outputs.
- Provider self-report alone is not evidence.

## Layer 3 — Commercial reliability
Required:
- Success rate >= 98% in the bounded commercial validation sample.
- p95 generation latency <= 45 seconds.
- Refund failure rate = 0 for failed charged generations.
- Idempotent replay is verified.
- Provider failover is verified where an alternate eligible provider exists.
- Rate-limit / abuse-pressure behavior is verified.

## Layer 4 — Market release
Required:
- Authenticated Production Generate → durable Save → Preview/Asset Library E2E.
- Browser verification.
- Real mobile verification.
- Image abuse/safety suite passes.
- Monitoring/alerting is ready.
- GitHub main exact SHA equals Production runtime exact SHA.

## Release truth
Only when all four layers pass may AI Image be labelled `MARKET_SALES_READY` / `PRODUCTION_LIVE_VERIFIED`.

Until then the correct state is `HOLD` / `EVIDENCE_REQUIRED`, even when all code and CI contracts pass.
