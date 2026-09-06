# LANERIQ Anti Scam — P0 to P6 Execution Roadmap

This roadmap converts Security Fabric V4 from a target architecture into independently verifiable engineering stages. A phase is complete only when its exit gates pass. Architecture documents alone do not satisfy a phase.

## Global rules

1. One device = one LANERIQ Device Guardian owner.
2. No protection claim stronger than current verified evidence.
3. Device-critical protection must remain useful during cloud degradation.
4. Every cloud write path must be idempotent and deduplicated.
5. Raw private content is not uploaded by default.
6. Every major engine, model and policy requires rollback/kill-switch design before large rollout.
7. Mobile compute is own-device protection only; no cross-user community compute.
8. Production promotion requires exact build/runtime evidence and cannot be inferred from a successful branch build.

---

# P0 — Guardian Reliability Foundation

## Goal

Turn the Android prototype into a trustworthy, testable local Guardian rather than a manual scan app.

## Deliverables

- standalone Anti Scam Android project boundary
- Guardian foreground service with explicit user opt-in
- boot/package-update recovery where Android permits
- app install/update awareness
- local risk-signal collection for Developer Options, ADB and Accessibility state
- explicit Guardian start/stop controls
- persistent Guardian state notification
- protection-state truth model
- first Protection Lease schema and local issuance
- local event IDs and deduplication primitives
- local structured event log with bounded retention
- battery/thermal/resource governor skeleton
- fail-closed status when Guardian state cannot be verified
- unit/instrumentation test harness for state transitions

## P0 exit gates

- Guardian survives app UI closure during test window
- Guardian restores after supported reboot/package-update paths when opted in
- stopping Guardian immediately invalidates the Protection Lease
- stale heartbeat cannot display `Guardian Active`
- app install/update event is surfaced once, not duplicated
- cloud outage does not crash or falsely upgrade local protection status
- no `CLEAN`, `BANKING_SAFE`, or guaranteed-protection claim without evidence
- measured idle resource use is recorded on representative Android devices
- CI builds a signed test artifact and runs state-machine tests

---

# P1 — Local Security Broker + Embedded SDK

## Goal

Make Anti Scam the single device-security owner while AI App Builder and future LANERIQ apps consume protection safely.

## Deliverables

- Android same-publisher trusted Broker interface
- signature-level read-protection-status permission
- explicit package-scoped discovery
- Protection Lease verification in consumer SDK
- deep-link remediation contract
- local request rate limiting
- local scan/result deduplication
- consumer fallback states: Guardian Active / Degraded / Paused / Cloud-only / Unknown
- AI App Builder embedded Security SDK adapter
- no second LANERIQ Guardian or VPN path in consumer apps

## P1 exit gates

- two LANERIQ apps installed simultaneously use one Guardian only
- consumer app cannot forge a stronger protection state
- Broker unavailable -> consumer automatically downgrades state
- no duplicate persistent notification
- no duplicate scan for identical request inside deduplication window
- compatibility tests pass across supported Android versions

---

# P2 — Regional Edge Foundation

## Goal

Move routine cloud lookups away from a single central path while preserving local-first behavior.

## Deliverables

- region-aware Security Provider Router
- regional URL/domain reputation cache
- regional hash reputation cache
- signed policy/reputation snapshot distribution
- event admission control
- per-device/account rate limits
- idempotency keys and duplicate suppression
- regional queue/stream abstraction
- bounded exponential retry and backpressure
- privacy-minimized telemetry envelope
- edge health and fallback routing

## P2 exit gates

- edge loss falls back without disabling local protection
- repeated identical events do not create duplicate incidents
- read-heavy reputation traffic is cacheable
- synthetic burst tests demonstrate queue absorption and backpressure
- no single external AI/reputation provider is required for device-critical protection

---

# P3 — Security Event Graph + Global Intelligence

## Goal

Correlate weak signals into incidents and identify campaigns without treating a single signal as malware proof.

## Deliverables

- canonical Security Event Envelope
- normalized threat fingerprinting
- local incident graph builder
- regional incident aggregation
- global threat/campaign graph
- reputation fusion
- specialized model router
- model confidence/evidence contract
- campaign clustering
- Truth Gate policy engine
- evidence trace for every high-risk verdict

## P3 exit gates

- unknown APK + Accessibility + remote-control-like signals can form one incident graph
- repeated events from one incident are correlated, not spammed
- single weak signal does not automatically become malware verdict
- global enrichment can improve a local incident without blocking first-response guidance
- verdicts include evidence provenance and model/policy versions

---

# P4 — Active/Active Multi-Region Security Plane

## Goal

Operate multiple regions independently while sharing summarized intelligence globally.

## Deliverables

- active/active regional ingress
- independent regional queues and caches
- regional storage boundaries
- global summarized-intelligence replication
- region routing and evacuation
- cross-region failover tests
- degraded-mode policy snapshots
- disaster recovery runbooks
- regional observability/SLOs
- data residency hooks where required

## P4 exit gates

- one region can be removed from service without disabling other regions
- inter-region impairment does not stop local/regional protection paths
- routing can evacuate a degraded region
- recovery point/recovery time targets are measured rather than assumed
- no universal dependency on one region or one database

---

# P5 — Global Edge Reputation Network + Safe Rollout Control

## Goal

Distribute threat intelligence globally with very low lookup latency while containing blast radius from bad policies/models.

## Deliverables

- globally distributed signed reputation bundles
- edge cache hierarchy
- canary cohorts
- staged percentage rollout
- region-by-region promotion
- engine/model shadow mode
- false-positive gate
- policy simulation
- per-engine kill switch
- emergency rollback
- key rotation/revocation
- signed client and policy verification

## P5 exit gates

- policy can be halted before global rollout
- rollback works without requiring a full mobile-store release where architecture permits
- false-positive regression blocks promotion
- compromised/retired signing material can be revoked
- global read traffic remains cache-dominant under load test

---

# P6 — Billion-Scale Evidence Program

## Goal

Prove progressive scalability and operational safety through evidence, not marketing claims.

## Deliverables

- scale-test ladder: 10K -> 100K -> 1M -> 10M -> 100M -> 1B simulated/derived workload targets
- workload model separating benign local-only events from escalated cloud events
- cost-per-active-device model
- cost-per-escalated-security-event model
- regional capacity model
- queue saturation tests
- cache hit-rate targets
- model invocation budget
- telemetry minimization metrics
- false-positive benchmark factory
- adversarial abuse/device-farm tests
- chaos/failover exercises
- independent security review/penetration testing plan

## P6 exit gates

- each scale step has measured throughput, latency, error rate, queue depth, cache hit rate and unit cost
- projected next-step capacity is based on measured lower-step results
- incident-response and rollback drills pass under synthetic global spikes
- false-positive/false-negative benchmarks are tracked over time
- no claim of billion-user production capacity until the required real infrastructure and evidence gates exist

---

# Execution order

P0 -> P1 -> P2 -> P3 -> P4 -> P5 -> P6

Some research may run in parallel, but no later phase may weaken an earlier invariant. In particular, regional/global intelligence must never become a prerequisite for basic local Guardian truth and safety.
