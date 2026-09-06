# Batch 140 — Mother AI Adaptive Compute

## Goal

Unify LANERIQ AI and Mother AI as one intelligence identity, replace high device-load compute profiles with a user-first 0–5% adaptive scheduler budget, and establish separate consent boundaries for Personal Compute and future Community Compute.

## Product identity

- **LANERIQ AI** is the product/platform.
- **Mother AI** is LANERIQ AI's core intelligence identity, not a separate agent or provider.
- Provider routing, local compute, same-user device routing, Edge Compute and future LANERIQ infrastructure are implementation layers behind Mother AI.

## Adaptive Compute Budget

The scheduler must treat **5% as a hard ceiling, never as a target**.

- 0% is always a valid state.
- Eco is designed for roughly 0–1% extra compute.
- Balanced is designed for roughly 1–3% when the device has comfortable headroom.
- Enhanced may reach 5% only for short eligible work.
- Mobile/tablet devices are capped more aggressively when not charging.
- Low battery, heat pressure and disallowed background execution can reduce the budget to 0%.
- Thermal Guardian cannot be disabled by stored or user-controlled state.
- Browser runtimes must not fabricate healthy thermal telemetry.

These values are scheduler ceilings/duty-cycle budgets, not promises that every operating system exposes exact CPU/GPU utilization control.

## Consent boundaries

### Personal Compute

Personal Compute is the first-use opt-in that allows Mother AI to use a small amount of the user's own CPU/GPU/NPU for that user's eligible LANERIQ work.

It remains OFF before the user's explicit decision.

### Community Compute

Community Compute is separate and OFF by default.

Turning on Personal Compute must never silently turn on Community Compute.

The user-facing explanation must state that Community Compute means allowing a small amount of otherwise-unused compute capacity to support LANERIQ's distributed AI network. Compute permission is not permission to read unrelated files, passwords, contacts, messages or browsing history.

## Current execution gate

This batch establishes the **Community Compute preference and consent boundary only**.

Cross-user/community workload execution remains **not live** in the current web runtime and must remain blocked until a separate secure Edge Compute runtime is admitted with:

- signed workload envelopes;
- workload sandboxing;
- encrypted transport;
- privacy classification and sensitive-workload blocking;
- result verification;
- node reputation/integrity controls;
- abuse and malware defenses;
- failure/retry handling;
- explicit production evidence.

The legacy cross-user execution flag remains forced OFF.

## Privacy-first rule

LANERIQ does not use a tracking-based business model for Mother AI Device Intelligence.

- Compute permission and content permission are separate.
- Private-data upload remains OFF by default for device compute.
- Community Compute must not be presented as authorization to inspect unrelated private content.
- Necessary reliability/security telemetry should be minimized and kept separate from advertising or behavioral profiling.

Legal/privacy production notices remain subject to their existing qualified review gate and must match actual production data flows before activation.

## User-experience priority

Resource priority remains:

1. User foreground activity
2. Operating system
3. User applications
4. User's own Mother AI / Personal Compute
5. Community Compute

Community Compute is always lowest priority and must yield immediately when device conditions are not comfortable.

## Evidence semantics

Batch 140 is **CODE / POLICY / UI** work.

It does **not** claim that cross-user Edge Compute is LIVE, DEVICE VERIFIED or PRODUCTION. The settings surface explicitly states that community workload execution is gated until the secure runtime is production-ready.
