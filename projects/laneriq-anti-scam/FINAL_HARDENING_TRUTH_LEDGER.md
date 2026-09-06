# LANERIQ Anti Scam — Final Hardening Truth Ledger

This ledger separates implementation from evidence. Code existence is never treated as proof of Production protection, malware efficacy, or billion-user capacity.

## Implemented in the isolated Project branch

### P0 Guardian Reliability
- explicit opt-in Always-On Guardian foreground service
- lease epoch/session/heartbeat Dead-Man evidence
- same-boot freshness and stale/clock degradation
- bounded restart circuit breaker
- boot/package/user-reopen recovery paths
- resource governor and thermal/power cadence
- expected user Pause vs unexpected service loss

### P0.5 Anti-Tamper & Survival
- no one-tap Stop action in persistent Guardian notification
- risk-aware in-app Pause flow
- elevated-risk Pause requires Android device credential step-up where available
- urgent remote-control/integrity state blocks ordinary Pause
- app signing-certificate continuity probe
- install-source continuity evidence
- alert-delivery integrity separated from Guardian liveness
- platform integrity state for notification/background/battery restrictions
- Protection Recovery Center uses only user-controlled Android settings pages
- Cross-App Witness Provider is signature-permission protected and read-only
- Provider shares minimal protection truth only; no URL history/event log/private content
- Guardian Witness fail-closed policy when Provider/lease becomes unverifiable
- witness replay guard for epoch/heartbeat rollback, stale/future evidence
- privacy-safe Cloud Dead-Man heartbeat schema and freshness/sequence checks
- missing/stale heartbeat never authorizes hacker attribution
- Force Stop truth boundary: ordinary Android apps cannot guarantee automatic restart after a true OS Force Stop

### Web / loss prevention
- local Safe Web heuristic
- hashed local reputation indicators
- False-Positive Safety: heuristic-only high risk stops at an interstitial; strong known-malicious claims require trusted evidence
- signed web-reputation evidence path in Security Fabric
- evidence TTL/revocation
- NetworkProtectionCapability truth gate
- VPN ownership integrity policy for future real Web Shield; current build remains MANUAL_CHECK_ONLY

### App/APK/file risk
- selected file SHA-256
- selected APK package/version/signer/permission/Accessibility/Device Admin/overlay capability inspection
- metadata/permissions cannot manufacture MALICIOUS or virus verdicts
- signed malware-evidence path in Security Fabric
- unverified Android local cache cannot write KNOWN_MALICIOUS

### Anti-remote-control / sensitive actions
- Developer Options / ADB / Accessibility local technical risk snapshots
- correlated Emergency Mode
- SensitiveActionGate for LANERIQ-controlled banking/payment/recovery flows
- unexpected Guardian loss can freeze LANERIQ-controlled sensitive actions
- no absolute claim that remote compromise is impossible

### Privacy First
- no raw private message/password/cookie/token/private-key/clipboard/full history/contact/photo/video/microphone/screen-content threat telemetry by default
- privacy envelope rejects forbidden/unknown fields rather than silently accepting them
- scoped pseudonyms and hashed threat indicators
- Android manifest CI gate blocks broad surveillance permissions by default
- no cross-user mobile compute

### P1–P6 Security Fabric foundations
- verified Guardian Proof -> Broker path
- regional edge routing/admission/backpressure/sharding
- Security Event Graph + evidence provenance
- active/active and partition/degraded policies
- Ed25519 policy verification, staged rollout, kill switch, tamper-evident audit chain
- measured capacity evidence ladder 1K -> 10K -> 100K -> 1M -> 10M -> 100M -> 1B
- no manual `passed:true` capacity bypass

## External evidence still required before Production claims

These cannot be completed honestly by source-code changes alone:

1. Real Android VpnService/network filtering data plane, consent flow, ownership evidence, IPv4/IPv6 and network-handoff testing.
2. Real signed threat-reputation ingestion into Android local cache.
3. Trusted malware scanner/sandbox/reputation providers and malicious/benign/false-positive benchmark corpora.
4. Real-device process-kill, Force Stop, reboot, package update, notification revocation, battery/background restriction, thermal and >=24h soak evidence across OEM/device matrix.
5. AI App Builder consumer integration and two-app coexistence/Cross-App Witness tests.
6. Production Cloud Dead-Man endpoint, scoped pseudonym key management, rate limits, retention policy and regional privacy review.
7. Production signing-key custody/HSM or equivalent, immutable audit storage and real canary automation.
8. Deployed regional active/active infrastructure with measured SLO/failover evidence.
9. Real staged capacity/load/cost evidence through the capacity ladder. 1B remains a design target until the full ladder passes.
10. Store-policy review for foreground service/VPN/network security capabilities before public release.

## Non-negotiable truth rules

- `Guardian Active` requires fresh local Guardian proof.
- `System-Wide Web Shield Active` requires a real healthy verified network filter/tunnel and ownership evidence.
- `KNOWN_MALICIOUS` requires trusted signed threat evidence; heuristic risk is not relabeled as malware.
- `CLEAN`, `virus-free`, `BANKING_SAFE`, `hacker-proof`, `impossible to stop`, `100% protected`, and billion-scale Production claims are forbidden without the corresponding independent evidence.
- Guardian/provider/cloud unavailability may mean protection verification is lost; it never by itself proves hacker activity.
- Privacy is a protection constraint, not telemetry to trade away for convenience.
