# LANERIQ Anti Scam — External Validation Runbook

This runbook is the execution path from release-candidate source to public-store evidence. It does not allow source code to substitute for real measurements.

## L1 — Real-Time Interception

Evidence must cover the exact production candidate and include:

- Android VPN consent granted through the platform flow;
- tunnel/filter ownership and health proof;
- IPv4 and IPv6 traffic;
- Wi-Fi ↔ cellular handoff;
- sleep/wake and network-loss recovery;
- another-VPN conflict behavior;
- malicious-domain block examples from signed threat evidence;
- benign/false-positive benchmark results;
- proof that low-confidence heuristic results are not relabeled as known malicious;
- privacy/network trace showing only intended security data leaves the device.

If a real system-wide network shield is not shipping, the UI/listing must keep this capability disabled or described as manual/on-demand only and the corresponding Production gate remains unsatisfied.

## L2 — Malware / App Efficacy

Evidence must identify provider/model/engine versions and include:

- trusted reputation provider verification;
- scanner and/or sandbox provider verification;
- signed evidence ingestion test;
- malicious corpus benchmark;
- benign corpus / false-positive benchmark;
- corrupted/unreadable/oversized sample handling;
- offline/cache behavior;
- proof that permission/capability metadata alone cannot emit a malware verdict.

No `CLEAN`, `virus-free`, or equivalent absolute result is authorized solely from absence of a detection.

## L3 — Guardian Real-Device Survival

Run against a documented device/OS/OEM matrix. At minimum capture:

- UI task removal;
- process kill;
- true Force Stop boundary and user-reopen recovery;
- reboot;
- package/app update;
- notification permission disabled/re-enabled;
- battery saver/background restriction;
- thermal stress/reduced cadence;
- network unavailable;
- Guardian restart circuit-breaker behavior;
- >=24 hour soak;
- AI App Builder / Anti Scam two-app Witness coexistence;
- Witness cryptographic proof, key continuity and anti-replay.

Every run must record exact app SHA/version, device model, OS build, start/end timestamps and observed result.

## L4 — Production Trust + Cloud

Evidence must cover:

- deployed privacy-safe Cloud Dead-Man endpoint;
- scoped pseudonym key management and rotation;
- authentication/authorization;
- rate limiting and abuse protection;
- retention/deletion policy;
- regional/data-residency review;
- encrypted transport;
- production signing/upload-key custody;
- immutable/tamper-evident audit storage;
- canary rollout;
- per-engine kill switch;
- rollback drill;
- cloud outage behavior proving local protection truth degrades correctly rather than lying.

## L5 — Production Scale + Store

Evidence must cover:

- exact branch/main alignment before final release build;
- production-signed AAB / iOS archive as applicable;
- artifact SHA and signing certificate/team identity;
- Google Play / App Store declarations matching the exact binary;
- public privacy policy URL;
- Data Safety / App Privacy review;
- multi-region deployment and failover SLO;
- staged load/latency/error/headroom/cost evidence through the capacity level actually claimed;
- final store listing truth scan;
- final Production Release Control exact-source/artifact/runtime verification where applicable.

## Evidence-token procedure

For each gate:

1. create an immutable/auditable proof artifact;
2. use the gate id from `EXTERNAL_RELEASE_EVIDENCE_TEMPLATE.json`;
3. include the immutable `proofRef`, trusted `verifierId`, `measuredAtMs`, and `status=PASS`;
4. sign the canonical payload with the approved release-evidence key;
5. verify against a pinned public key in `TRUSTED_RELEASE_EVIDENCE_KEYS.json`;
6. rerun `launch-report.mjs` for the exact shipping candidate.

Public Production remains blocked until all applicable five-layer gates verify.
