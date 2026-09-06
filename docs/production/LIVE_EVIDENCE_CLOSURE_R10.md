# LANERIQ AI — Round 10 LIVE Evidence Closure

Status: FAIL-CLOSED / Production pending

This round does not add speculative product capability. It converts the remaining Production Cognitive Gate requirements into an auditable evidence-closure program.

## Evidence ladder

SPEC → CODE → CI → BROWSER VERIFIED → DEVICE VERIFIED → PROVIDER LIVE → PRODUCTION

Preview readiness, fixtures, mocks, static CI and simulated evidence MUST NOT be promoted to a higher evidence class.

## 10 closure lanes

1. Exact-SHA convergence — GitHub main SHA, Vercel Production source SHA and runtime verified SHA must be identical.
2. Supabase durability — apply the approved Cognitive migrations only after merge to main; verify RLS and owner isolation; prove durable ledger writes by read-after-write evidence.
3. Provider LIVE — execute a real benchmark against at least two distinct external providers; record provider identity, model, request/result digest, latency and timestamp without storing secrets.
4. Independent benchmark attestation — create a signed/digested attestation over the real multi-provider evidence; fixtures cannot satisfy this lane.
5. Feature Judges — verify judge execution across App Builder, AI Image, AI Video and Malware surfaces with traceable evidence IDs.
6. Cognitive Self-Heal — prove bounded recovery with before/after evidence and no silent authority expansion.
7. Constitutional execution — verify execution-token issuance/validation, guarded tool execution, human sovereignty, critical veto and no-domination invariants.
8. Constitutional Red Team — run independent/repeated adversarial scenarios and retain immutable evidence; synthetic unit tests alone do not close this lane.
9. Runtime surfaces — verify Production API, browser/UI, App Builder and Malware behavior; device-only claims remain pending until real-device evidence exists.
10. Human release approval — final release requires explicit human approval after all machine-verifiable checks pass. Automation must never synthesize this approval.

## Mandatory release invariants

- SMS remains on hold.
- Mobile cross-user Community Compute remains disabled; mobile may use own-device/local compute only.
- No dedicated LANERIQ-owned server is introduced in this round; Provider Router/server-independent architecture remains the default.
- Secrets remain server-side and must never be written into evidence artifacts.
- Any missing, stale, mismatched or unverifiable evidence produces BLOCK, never WARN-to-PASS.
- A change to main after candidate verification invalidates exact-SHA closure and requires re-alignment plus CI rerun.
- Production database mutation occurs only after the exact candidate is merged into main.
- Production closure may be claimed only when the repository Production Cognitive Gate returns PASS using LIVE evidence.

## Evidence manifest contract

Every evidence record should include: `evidenceId`, `class`, `candidateSha`, `source`, `observedAt`, `digest`, `verdict`, and redacted metadata. Production records additionally bind `githubMainSha`, `vercelProductionSha`, and `runtimeVerifiedSha`.

## Stop conditions

Immediately stop promotion on SHA drift, migration/RLS failure, provider count < 2, failed independent attestation, failed red-team invariant, browser/API/device regression, or absent human approval.
