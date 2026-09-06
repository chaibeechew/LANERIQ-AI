# LANERIQ Cognitive Operating System v1

Status: CODE / CI architecture and runtime layer. This document does not claim Production intelligence superiority or live external verification.

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

Round 2 adds a bounded Failure Memory store and an adapter-based repository boundary. Round 4 adds an independent append-only Supabase `cognitive_failure_memory` table, owner/app RLS and explicit Data API grants. It remains separate from `project_memory.memory_json` and its strict whitelist. The migration is repository-ready but is not claimed as already applied to Production.

## Provider Router contract
Cognitive OS requests capabilities, not vendor identity. The routing policy is capability-first, then quality, latency, cost and availability. Council/verified-critical paths prefer failover and cross-provider verification when eligible providers exist. No dedicated LANERIQ-owned server is required by this layer.

## Shared cognitive service
The shared cognitive service covers App Builder, Malware Defense, AI Image, AI Video and Production Release. Each domain has an explicit risk/complexity/capability profile. Production Release is always `verified-critical`, requires human approval, and cannot become unbounded autonomous execution.

Round 3 wires the service into real runtime boundaries without bypassing zero-cost admission, provider routing, output validation, durable media capture, or deterministic Malware enforcement.

Round 4 adds feature-specific Judges and a bounded Cognitive Self-Heal feedback loop. Production Release cannot self-heal itself into approval. Malware Defense cannot use Cognitive repair to override deterministic enforcement.

## Privacy-safe Cognitive telemetry
Round 3 adds a bounded in-process telemetry ring containing domain, phase, reasoning mode, evidence class, council/approval requirements, outcome, provider class, latency and SHA-256 operation digest only.

Round 4 adds a durable Cognitive Event Ledger adapter and append-only Supabase schema. Telemetry may report durable only when a migration-verified adapter is configured and no persistence failure is observed. Raw prompts, customer payloads and secrets remain forbidden.

## Execution boundary
Executable work is least-privilege and sandbox-oriented. Network, background compute, shared compute and private-data reuse are explicit permissions. Destructive, financial, Production, critical, or high-risk external-side-effect work requires human approval, rollback planning and dry-run where applicable.

## Judge and Self-Heal
Acceptance requires completion, tests, security, privacy, output verification, sufficient evidence, resolved contradictions and minimum confidence. Failed non-critical work returns to bounded repair/reason-again. Critical failure blocks and escalates.

Round 4 introduces domain-specific fail-closed checks for App Builder, Malware Defense, AI Image, AI Video and Production Release plus a maximum-three-round repair → verify → Judge loop. Self-Heal may not self-grant permissions, disable safety checks, lower quality gates or raise evidence class without new observed evidence.

## LANERIQ Intelligence Benchmark
The benchmark covers 15 domains: reasoning, coding, planning, research, agent execution, long-horizon completion, memory, self-healing, hallucination resistance, security, tool use, multimodal, app building, business reasoning and cost optimization.

Round 2 adds deterministic campaign bookkeeping. Round 4 adds a real multi-provider harness that requires at least two external providers, records actual provider identity plus prompt/result/evaluator digests, and caps its own evidence at `MEASURED_OR_ATTESTED`. Production benchmark promotion requires separate independent attestation.

A high internal benchmark score is not a Production superiority claim.

## Production Cognitive Release Gate
Round 4 adds the final fail-closed gate. Closure requires GitHub `main` exact SHA = Vercel Production exact SHA = observed runtime SHA, required CI success, live Supabase durability/RLS verification, durable Cognitive writes, real multi-provider benchmark evidence from at least two external providers, independent benchmark attestation, all feature Judges, bounded Self-Heal verification, Supabase/API/Browser/Malware/App Builder/UI verification and explicit human release approval.

Static CI, Preview deployments, simulated evidence or internal benchmark scores cannot close Production by themselves.

## Integration with existing LANERIQ systems
- Existing Provider Router remains the provider execution boundary.
- Existing Project Memory remains separate from reusable method experience.
- Existing bounded Self-Heal remains bounded and cannot weaken safety gates.
- App Builder, AI Image, AI Video and Malware Defense consume the shared Cognitive contract at runtime boundaries without receiving extra permissions.
- Existing Production Release Control remains authoritative: GitHub `main` exact SHA = Vercel Production exact SHA = runtime verified SHA before Production closure.
- No dedicated LANERIQ-owned server is required by this layer.
- SMS remains outside this change and remains on hold.

## Release truth boundary
Rounds 1–4 now establish architecture, executable Council orchestration, cross-feature runtime wiring, Failure Memory/ledger/benchmark durability migrations and adapters, feature Judges, bounded Cognitive Self-Heal, real multi-provider benchmark harness, Production Cognitive Gate, tests and CI. This still does not claim that the new Supabase migration is already applied to Production, that external benchmark evidence has already been independently attested, or that Production Cognitive closure has already passed. Those claims require exact merged-SHA live evidence through Production Release Control.

See `docs/LANERIQ_COGNITIVE_OS_FINAL_SIX.md` for the six-layer transfer contract.
