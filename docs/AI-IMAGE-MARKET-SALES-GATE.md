# LANERIQ AI — AI Image Market Sales Gate

## Purpose
This gate closes the gap between AI Image code readiness and truthful market-sale readiness. It never converts simulated, configured, CI-only, or provider-self-reported evidence into LIVE VERIFIED status.

## Layer 1 — Production runtime wiring
Required:
- `/api/images/generate` uses the hardened creative-media execution path for provider-backed generation.
- Real-output quality failure is fail-closed for model claims.
- Atomic credit charge/refund remains intact.
- Provider output is durably captured in the owner's private Asset Library before release.

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
