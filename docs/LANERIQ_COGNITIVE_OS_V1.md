# LANERIQ Cognitive Operating System v1

Status: CODE / CI architecture layer. This document does not claim Production intelligence superiority or live external verification.

## Goal
Upgrade the existing Soolen Super Brain into a provider-independent LANERIQ intelligence system that can understand goals, reason at an appropriate budget, use independent council review, simulate consequences, track uncertainty, enforce evidence classes, learn privacy-safe failure patterns, execute only inside permission boundaries, self-heal in bounded loops, and measure intelligence with reproducible benchmarks.

## 20-layer architecture
1. Intent Engine
2. Context Engine
3. Memory Graph
4. Knowledge Engine
5. Cognitive Router
6. Model Router
7. Reasoning Engine
8. Multi-Agent Council
9. World Simulator
10. Planner
11. Execution Engine
12. Verification Engine
13. Judge System
14. Security & Trust
15. Self-Healing Engine
16. Learning Engine
17. Personal Intelligence
18. Autonomous Workflow
19. Intelligence Benchmark
20. Meta-Cognition

## Reasoning budget
LANERIQ selects one of four modes: `fast`, `deep`, `council`, or `verified-critical`. Critical/high-impact irreversible work must escalate rather than silently use the cheapest path.

## Cognitive Council
The first council round is blind and independent. Explorer, Conservative, Challenger, Evidence and Systems roles cannot see each other's candidate answers before round one. Judge receives candidate summaries only after the independent pass. No agent may self-grant permissions.

Round 2 adds an executable Council runtime. Council seats call the existing provider execution boundary through `generateWithFallback` by default, while contract tests inject a deterministic mock generator. Candidate raw responses are represented by SHA-256 response digests in the runtime evidence surface. The Judge receives bounded candidate summaries after the independent round.

Round 3 adds an observable provider-diversity policy. When multiple configured/authorized providers are available, worker seats prefer unused providers first and the Judge prefers a provider not already used. Runtime evidence records the actual distinct provider count and whether the diversity target was satisfied. A single-provider environment remains allowed but cannot claim cross-provider diversity.

## World simulation and counterfactuals
The simulator creates baseline, growth, 100x stress, provider-outage and adversarial scenarios plus counterfactual questions. Simulation evidence remains `SIMULATED`; it cannot become measured or Production evidence merely because the simulation passed.

## Uncertainty and evidence
Every cognitive result can carry evidence coverage, source agreement, test coverage, contradictions, unknowns, evidence class and external-verification requirement. Low confidence, contradictions, multiple unknowns or external-verification requirements trigger escalation.

Evidence classes are ordered as:
`INTERNAL` → `SIMULATED` → `STATIC_PREFLIGHT` → `MEASURED_OR_ATTESTED` → `PRODUCTION`.

No lower class may be promoted into a higher class without the corresponding real evidence.

## Failure Memory
Failure Memory stores method-level signals only: failure code, generalized strategy, repair pattern, provider/runtime class and whether the repair succeeded. Raw prompts, raw customer data, credentials, secrets, private files and source code are rejected from reusable Failure Memory.

Round 2 adds a bounded Failure Memory store and an adapter-based repository boundary. The repository requires explicit `load` and `save` adapters and does not silently choose a database. The current Supabase Project Memory database contract has a strict top-level field allowlist, so Failure Memory is intentionally **not** written into `project_memory.memory_json` in this batch. A separate reviewed Supabase migration and database test gate is required before durable database wiring.

## Provider Router contract
Cognitive OS requests capabilities, not vendor identity. The routing policy is capability-first, then quality, latency, cost and availability. Council/verified-critical paths prefer failover and cross-provider verification when eligible providers exist. No dedicated LANERIQ-owned server is required by this layer.

## Shared cognitive service
Round 2 adds one shared cognitive service contract for:
- App Builder
- Malware Defense
- AI Image
- AI Video
- Production Release

Each domain has an explicit risk/complexity/capability profile. Production Release is always `verified-critical`, requires human approval, and cannot become unbounded autonomous execution.

Round 3 wires the service into real runtime boundaries:
- App Builder admission creates a Cognitive envelope and injects the Cognitive execution contract into the existing generation prompt without bypassing zero-cost admission, private reuse scoping or provider routing.
- AI Image creates a local Cognitive envelope at the external image gateway, emits privacy-safe method telemetry and sends only bounded mode/evidence headers in addition to the unchanged provider request schema.
- AI Video applies the same pattern at renderer submission and status-check boundaries while preserving idempotency, approved-output validation and durable capture requirements.
- Malware Defense attaches Cognitive risk/evidence metadata to the deterministic runtime-defense pipeline. Cognitive metadata cannot override ALLOW/HOLD/QUARANTINE/RANSOMWARE enforcement decisions.

## Privacy-safe Cognitive telemetry
Round 3 adds an in-process bounded telemetry ring for method-level runtime evidence. Events include domain, phase, reasoning mode, evidence class, council/approval requirements, outcome, provider class, latency and a SHA-256 operation digest. Telemetry explicitly excludes raw prompts, raw customer data and secrets. It is not durable and is not a Production observability claim.

## Execution boundary
Executable work is least-privilege and sandbox-oriented. Network, background compute, shared compute and private-data reuse are explicit permissions. Destructive, financial, Production, critical, or high-risk external-side-effect work requires human approval, rollback planning and dry-run where applicable.

## Judge and Self-Heal
Acceptance requires completion, tests, security, privacy, output verification, sufficient evidence, resolved contradictions and minimum confidence. Failed non-critical work returns to bounded repair/reason-again. Critical failure blocks and escalates.

## LANERIQ Intelligence Benchmark
The benchmark covers 15 domains: reasoning, coding, planning, research, agent execution, long-horizon completion, memory, self-healing, hallucination resistance, security, tool use, multimodal, app building, business reasoning and cost optimization.

Round 2 adds a campaign runner that creates deterministic domain cases, records score/pass/duration/evidence class, rejects evidence-class drift, emits per-result SHA-256 digests, and produces a campaign digest. Internal or simulated campaigns may qualify engineering thresholds but cannot claim Production benchmark verification.

A high internal benchmark score is not a Production superiority claim. `mayClaimProductionBenchmarkVerified` remains false until qualifying benchmark evidence is actually Production-class and externally verified.

## Integration with existing LANERIQ systems
- Existing Provider Router remains the provider execution boundary.
- Existing Project Memory remains separate from global reusable experience.
- Existing bounded Self-Heal remains the repair executor; Cognitive OS supplies escalation/judging policy.
- App Builder, AI Image, AI Video and Malware Defense now consume the shared Cognitive contract at runtime boundaries without receiving extra permissions.
- Existing Production Release Control remains authoritative: GitHub `main` exact SHA = Vercel Production exact SHA = runtime verified SHA before Production closure.
- SMS remains outside this change and remains on hold.

## Release truth boundary
This batch establishes architecture, deterministic contracts, executable Council orchestration, provider-diversity evidence, shared domain profiles, cross-feature runtime wiring, privacy-safe in-process telemetry, adapter-bounded Failure Memory and benchmark campaign code. It does not claim that external models were benchmarked live, that every provider is connected, that Failure Memory is already durably stored in Supabase, that telemetry is a durable Production observability system, that a real-world simulation is measured evidence, or that LANERIQ is already more intelligent than another named model. Those claims require independent benchmark campaigns, reviewed persistence migrations and exact Production evidence.
