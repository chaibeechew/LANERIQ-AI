# LANERIQ Cognitive OS — Final Six Transfer

Status: CODE / migration / CI contract transfer in PR #394. Not merged to `main`; not applied to Production Supabase; not a Production intelligence-superiority claim.

## 1. Failure Memory independent database + RLS

Migration `20260906102500_cognitive_durability_layer.sql` creates `public.cognitive_failure_memory` as an append-only owner-scoped table. It is deliberately separate from `project_memory.memory_json` so the existing Project Memory whitelist and privacy boundary remain unchanged.

The table stores only generalized method metadata: category, failure code, strategy, repair pattern, provider/runtime class, repair outcome and SHA-256 method digest. It has hard false checks for customer raw data and secrets. `anon` has no access. `authenticated` receives explicit `SELECT, INSERT` only and RLS verifies both `owner_id` and app ownership when `app_id` is present. `service_role` remains server-only.

## 2. Durable Cognitive Event Ledger

`public.cognitive_event_ledger` is append-only and owner-scoped. It stores operation digest, domain, phase, reasoning mode, evidence class, council/approval flags, outcome, provider class, latency and event digest. It never stores the raw operation id, prompt, customer payload or secret.

`cognitive-integration.js` now supports a durable persistence adapter, pending-write tracking, flush, write/failure counters and a durable truth flag. The in-memory telemetry remains available as a bounded runtime cache; Production durability is true only when a migration-verified adapter is configured and no persistence failure is observed.

## 3. Real multi-provider benchmark harness

`multi-provider-benchmark.js` can execute fixed benchmark cases against provider-specific routes through the existing LANERIQ Provider Router. At least two external providers are required. The harness records prompt/result/evaluator digests, actual provider class, score, pass/fail and duration.

The harness automatically caps evidence at `MEASURED_OR_ATTESTED`. It never self-promotes a live provider run into `PRODUCTION`. Production promotion requires a separate independent attestation and the Production Cognitive Gate.

`public.cognitive_benchmark_evidence` persists benchmark receipts without raw prompts or raw outputs. A database constraint rejects `PRODUCTION` evidence unless `externally_verified = true`.

## 4. Feature-specific Judge layer

Five fail-closed Judge profiles are now defined:

- App Builder: tests, security, ownership/RLS, output verification, preview verification.
- Malware Defense: tests, security, deterministic-decision preservation, ransomware protection, remediation and false-positive guard.
- AI Image: tests, security, provider-output validation, safety, quality Judge and durable capture.
- AI Video: tests, security, renderer-output validation, safety, quality Judge and durable capture.
- Production Release: tests, security, Supabase, API, browser, Malware, App Builder, UI, Cognitive durability, real-provider benchmark and exact-SHA verification.

A Cognitive Judge cannot override deterministic Malware enforcement and cannot lower a safety gate.

## 5. Cognitive Self-Heal feedback loop

`cognitive-self-heal.js` adds a bounded repair → verify → Judge loop with a hard maximum of three rounds. Repairs are restricted to failed checks and may not self-grant permissions, disable safety checks, lower quality gates, or raise an evidence class without newly observed evidence.

Production Release never auto-repairs into approval. Malware Defense may only use automatic repair when deterministic enforcement is explicitly preserved. Exhausted non-accepted repairs can write privacy-safe Failure Memory through the adapter.

## 6. Production Cognitive Release Gate

`production-cognitive-gate.js` is the final fail-closed control plane. A Production cognitive closure requires all of the following at the same time:

- valid 40-character GitHub `main`, Vercel Production and observed runtime SHAs;
- exact equality of all three SHAs;
- Cognitive OS, Core Release, AI 100, Benchmark Factory, App Builder, Malware Defense and Creative Media gates successful;
- Failure Memory migration + RLS verified in the real Production database;
- Cognitive Ledger migration + RLS + durable write verified in the real Production database;
- real multi-provider benchmark verified with at least two external providers;
- independent benchmark attestation verified;
- all feature Judges verified;
- bounded Cognitive Self-Heal feedback verified;
- Supabase, API, Browser, Malware, App Builder and UI verified;
- explicit human Production release approval.

Static CI, simulated evidence, internal benchmark scores, Preview deployments, or feature-branch evidence cannot close this gate by themselves.

## Supabase 2026 compatibility

The migration uses explicit grants in addition to RLS because Supabase's 2026 Data API behavior no longer permits code to assume newly created public tables are automatically exposed. No `SECURITY DEFINER` function is introduced. The `realtime` schema is not modified.

## Truth boundary

This batch means all six remaining layers are transferred into the LANERIQ repository as implementation + migration + verification contracts. It does **not** mean the migration has already been applied to Production, that live provider benchmark evidence has already been generated, or that the final Production Cognitive Gate has already passed. Those become real only after Production Release Control merges the exact PR result and performs the live evidence steps against the exact merged SHA.
