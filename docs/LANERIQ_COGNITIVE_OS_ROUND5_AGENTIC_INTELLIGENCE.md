# LANERIQ Cognitive OS — Round 5 Adaptive Agentic Intelligence

Status: CODE / CI target. This round transfers current agentic architecture patterns into LANERIQ-owned orchestration contracts. It does not claim external protocol conformance or Production superiority.

## Technology targets
- Adaptive inference-time compute with bounded candidate generation, verifier passes and early stopping.
- Verifier-guided candidate selection instead of trusting a single generation.
- MCP target semantics: 2026-07-28 stateless request/response core, header-routable method/name metadata, cacheable/stable capability catalogs, authorization hardening and task-oriented long-running work.
- A2A target semantics: 1.0.0 Agent Card discovery and Task lifecycle for opaque cross-agent collaboration.
- Context Engineering: deterministic context packs, provenance digests, stable cache ordering, token/character budget and prompt-injection quarantine.
- Per-tool guardrails with preflight/postflight tripwires and blocking mode for Production/destructive/high-risk tools.
- Sandboxed execution requirement for executable or high-risk work.
- Privacy-safe hierarchical Trace/Span runtime for task, agent, turn, generation, tool, guardrail, handoff, verification, Judge and Self-Heal events.

## Adaptive test-time intelligence
LANERIQ now computes a bounded inference plan from complexity, uncertainty, impact, risk, cost mode, available provider diversity and tool usage. The plan controls parallel candidate count, verifier passes, reasoning rounds, early-stop confidence, minimum score improvement and monitoring compute ratio.

The controller cannot increase permissions or promote evidence classes. Zero-cost mode reduces candidate fan-out instead of silently spending through paid providers.

## Verifier-guided selection
Candidate ranking weights correctness, security, evidence quality, calibration, reversibility and cost penalty. High raw correctness cannot automatically defeat a safer, better-evidenced candidate.

## MCP bridge truth boundary
LANERIQ creates an internal canonical stateless envelope targeting MCP 2026-07-28 semantics. It records `Mcp-Method` / `Mcp-Name`, request digest, stateless transport intent, authorization requirement and stable catalog preference.

This is **not** an external MCP compatibility claim. `externalConformanceVerified=false` and `mayClaimWireCompatibility=false` remain fail-closed until an actual MCP conformance campaign verifies the LANERIQ client/server implementation.

## A2A bridge truth boundary
LANERIQ can build an Agent Card target, publish the standard discovery path contract `/.well-known/agent-card.json`, and model the A2A 1.0 Task states:
- UNSPECIFIED
- SUBMITTED
- WORKING
- COMPLETED
- FAILED
- CANCELED
- INPUT_REQUIRED
- REJECTED
- AUTH_REQUIRED

Terminal tasks are immutable in the internal bridge. Internal memory, credentials and proprietary implementation details are not included in task objects.

This is **not** an A2A TCK pass. `externalTckVerified=false` and `mayClaimA2AConformance=false` remain fail-closed.

## Context Engineering
Each source receives trust, sensitivity, freshness, priority, evidence weight and a SHA-256 digest. Suspected prompt injection and secret sources are quarantined. Retrieved or agent-supplied content can act as evidence but cannot become system-level instructions.

## Tool guardrails
Every custom tool may receive preflight and postflight checks. Production, destructive, financial, critical or high-risk tools are moved to blocking preflight mode. Human approval remains mandatory where required. A guardrail tripwire prevents the tool from running or prevents its output from being accepted.

## Agentic tracing
Round 5 adds a hierarchical trace model inspired by modern production agent runtimes, while keeping LANERIQ's privacy boundary: raw prompts, raw customer data and secrets are not stored in trace spans. Inputs/outputs are represented by SHA-256 digests. The current trace runtime is in-process and non-durable; durable Production storage remains governed by the Cognitive Event Ledger layer.

## Composition
`createAgenticIntelligenceRun()` composes:
1. existing domain Cognitive run
2. Adaptive Inference plan
3. Context Engineering pack
4. optional Tool Guardrail plan
5. MCP or A2A target bridge
6. privacy-safe Trace root

This layer sits above the existing Cognitive Service and does not replace Provider Router, Feature Judge, bounded Self-Heal, durable evidence, Production Release Control or exact-SHA gates.

## Release truth boundary
Round 5 may be called CODE/CI-ready only after its contract test passes on the exact PR head. Production interoperability claims require separate evidence:
- MCP external conformance campaign
- A2A TCK / compatibility evidence
- sandbox runtime evidence
- durable trace/ledger evidence
- measured quality improvement from adaptive inference
- Production exact-SHA closure
