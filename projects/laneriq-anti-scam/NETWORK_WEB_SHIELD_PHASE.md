# LANERIQ Anti Scam — System-Wide Web Shield Implementation Gates

This document is a production-truth gate for Android network protection. It prevents a manual URL checker or an empty VPN interface from being marketed as a system-wide Web Shield.

## Current truth

Implemented today:

- local URL heuristic evaluation
- privacy-safe local domain indicator hashing
- local threat-reputation cache contract
- WebShieldPolicy BLOCK / INTERSTITIAL / ALLOW_WITH_CAUTION logic
- NetworkProtectionCapability truth state that refuses `SYSTEM_WIDE_ACTIVE` without real network-filter evidence

Not implemented yet:

- production packet forwarding/filtering engine
- VPN consent lifecycle
- real DNS/IP/TLS destination reputation enforcement
- encrypted DNS/DoH handling strategy
- production threat-reputation feed ingestion
- real always-on VPN lifecycle evidence

Therefore the Android UI must remain `MANUAL_CHECK_ONLY` for system-wide protection until all gates below pass.

## Android platform contract

The production Web Shield should use Android `VpnService` or another platform-approved network protection mechanism.

Hard rules:

1. User consent is required before LANERIQ first establishes its VPN.
2. LANERIQ Anti Scam is the only LANERIQ product allowed to own the device VPN. AI App Builder and future LANERIQ apps are consumers through the Security Broker.
3. The VPN service must be protected with `android.permission.BIND_VPN_SERVICE` and the `android.net.VpnService` intent filter.
4. A real tunnel/filter interface must exist before the product can display `SYSTEM_WIDE_ACTIVE`.
5. Closing/crashing the VPN must immediately downgrade the Protection Lease / NetworkProtectionCapability state.
6. Always-On support must never be confused with proof that filtering is healthy; health still requires heartbeat + filter/tunnel + policy evidence.
7. Lockdown / block-connections-without-VPN behavior is not enabled silently. It can break networking if the VPN implementation fails and requires an explicit user/admin choice appropriate to the platform mode.
8. Android foreground-service restrictions for the target SDK must be revalidated for every target-SDK upgrade.

## Enforcement pipeline

Target decision path:

`App traffic -> VpnService -> packet/DNS destination extraction -> local reputation -> signed regional reputation -> local heuristic/campaign policy -> BLOCK / ALLOW -> event evidence`

The engine should stop at the lowest-cost tier with sufficient evidence.

### BLOCK evidence

A destination can be blocked for:

- verified known-malicious reputation
- signed high-confidence phishing/campaign policy
- locally detected high-risk pattern that passes the configured blocking threshold
- sensitive banking/payment context combined with strong remote-control/web-risk evidence inside LANERIQ-controlled flows

### Never treat as proof of safety

- no cache hit
- successful TLS
- HTTPS alone
- a low heuristic score
- a domain not previously seen by LANERIQ

## Encrypted traffic boundary

The Web Shield must not become a content-surveillance product.

Default design:

- do not install a user CA to decrypt ordinary HTTPS traffic
- do not capture passwords, cookies, message bodies, private tokens, photos, microphone audio or screen contents
- prefer destination metadata, DNS/IP reputation, signed threat indicators and bounded technical features
- encrypted DNS / ECH / QUIC limitations must be surfaced honestly rather than hidden

## Reliability gates before `SYSTEM_WIDE_ACTIVE`

All must pass:

- explicit VPN consent flow
- one-VPN-owner coexistence test with AI App Builder installed
- tunnel/filter established health proof
- packet-forwarding correctness test
- DNS resolution correctness test
- IPv4 and IPv6 test
- Wi-Fi <-> cellular handoff test
- airplane-mode/reconnect test
- VPN revocation test
- app process kill/restart test
- device reboot test
- package upgrade test
- captive portal test
- split-tunnel/bypass policy test where supported
- battery/thermal measurement
- 24-hour soak
- false-positive benchmark against benign domains
- known phishing/malicious-domain benchmark
- kill switch / remote policy rollback test

## Fail behavior

Consumer default should prioritize not bricking connectivity while still being explicit about degraded protection.

If the network filter fails:

- `SYSTEM_WIDE_ACTIVE -> DEGRADED`
- Guardian remains active if its independent local service is healthy
- UI immediately states that system-wide web filtering is degraded
- local manual URL checks remain available
- user is told how to restore Web Shield

A stricter lockdown mode can be offered only as an explicit advanced/managed-device mode with clear consequences and platform support.

## Production exit condition

System-wide Web Shield may be marketed only after:

`user consent + real filter/tunnel + fresh policy + engine health + lifecycle tests + false-positive benchmark + known-threat benchmark`

are all evidenced by the release gate. Architecture or an empty VpnService declaration alone is not sufficient.
