# LANERIQ Anti Scam — P0.5 Guardian Anti-Tamper & Survival Layer

## Goal

Make it significantly harder for scam-assisted remote control, OS lifecycle events, or accidental settings changes to silently remove protection before a user loses money.

The product must detect loss of protection, fail closed for LANERIQ-controlled sensitive actions, recover when Android permits it, and never keep showing `Protected` after the evidence disappears.

## Non-negotiable truth boundary

P0.5 does **not** claim that LANERIQ can never be stopped.

A normal Android app cannot guarantee survival against all of the following:

- Android user-initiated Force Stop / stopped-package state
- root / device-owner / system-level attacker control
- OS or vendor security vulnerabilities
- physical device compromise
- uninstall/reinstall by a sufficiently privileged actor
- Android policies that temporarily block background foreground-service starts

A missing Guardian heartbeat is not, by itself, proof that a hacker caused the outage. It can also be caused by Android lifecycle behavior, background restrictions, a crash, reboot/session transition, user action, or other availability loss.

## Implemented P0.5 contracts

### 1. Expected vs unexpected shutdown

- explicit user stop remains `USER_PAUSED`
- `GuardianService.onDestroy()` no longer overwrites the explicit user-stop reason
- if the service ends while the user is still opted in, the lease is invalidated as `unexpected-service-destroy`
- stale/expired same-session evidence becomes `PROTECTION_LOST_UNEXPECTEDLY`
- restart-loop exhaustion becomes `RESTORE_THROTTLED`

### 2. Dead-Man Protection Lease

`Protected` requires a fresh same-boot Protection Lease with a non-zero heartbeat sequence and current service session.

When the lease expires:

- Anti Scam cannot claim Guardian Active
- companion LANERIQ apps must remove the protected claim
- LANERIQ-controlled sensitive actions can fail closed

### 3. Independent Witness, not a second Guardian

AI App Builder and future same-developer LANERIQ apps may use the signature-permission-protected Protection Status Provider as a witness.

The witness receives only minimal facts such as:

- opt-in state
- lease expiry / heartbeat sequence
- integrity state
- emergency state
- system Web Shield truth state
- self-integrity continuity state
- alert-delivery availability

It receives no browsing history, URL history, app history, local event log, stable raw installation ID, messages, contacts, tokens, files, photos, microphone content, or screen content.

If the Anti Scam provider itself becomes unreachable, that must never be interpreted as `USER_PAUSED`. A companion can use the last-known lease as a dead-man timer; once that prior lease expires, the companion may show `PROTECTION_LOST`, while still refusing to attribute the cause to a hacker without additional evidence.

### 4. Sensitive Action Freeze

For LANERIQ-controlled Banking / Payment / Password Change / Recovery flows:

- verified unexpected Guardian loss -> `FREEZE`
- only stale/unverified status with no unexpected-loss evidence -> `WARN`
- known malicious destination -> `FREEZE`
- correlated remote-control + web/new-app risk -> `FREEZE`

This policy does not claim LANERIQ can directly freeze or control arbitrary third-party banking apps.

### 5. App self-integrity continuity

The Android test app now checks signing-certificate continuity.

- first test run establishes a continuity baseline
- subsequent runs must remain in the same signing lineage/baseline
- unexpected signer change suspends normal protection claims and raises an integrity warning

Test-build continuity is not equivalent to production publisher-key pinning. Production release must pin/verify the expected release signer through trusted build/release metadata and validate key-rotation lineage.

### 6. Alert delivery integrity

Guardian protection and Guardian alert delivery are separate truths.

If Anti Scam notifications are disabled/blocked:

- Guardian may still be active
- alert delivery is marked `DEGRADED`
- companion Witness surfaces can warn the user
- the product must not pretend urgent alerts are visible

### 7. Restart safety

Automatic restore remains bounded by the Restart Circuit Breaker.

- repeated restart failures do not create an infinite crash/restart loop
- circuit-open state removes active protection claims
- reboot / update restore attempts remain evidence-gated

### 8. Force Stop recovery boundary

If Android places Anti Scam into a true stopped-package / Force Stop state, ordinary receivers/services cannot be trusted to restart themselves until Android/user interaction permits the package to run again.

The correct recovery model is:

1. companion/cloud Witness notices loss of fresh proof where available
2. user is told protection verification was lost
3. LANERIQ-controlled sensitive flows fail closed where appropriate
4. user reopens Anti Scam
5. Guardian establishes a new session/epoch/heartbeat
6. only then may `Protected` return

## Remaining P0.5 exit gates

P0.5 is not complete until real-device tests prove at least:

- explicit Stop vs process death classification
- UI task removal while Guardian remains active
- process kill / OS reclamation
- true Android Force Stop recovery boundary
- reboot and USER_UNLOCKED restore
- package replacement/update restore
- background FGS restriction behavior
- notification permission/channel disabled behavior
- signer-continuity behavior across test updates
- restart circuit-open behavior
- companion-provider unreachable + cached lease expiry behavior
- battery saver and thermal severe conditions
- 24-hour soak
- representative Samsung / Pixel / Xiaomi / Oppo / Vivo or equivalent OEM lifecycle matrix

## Production claim gate

Until those tests pass, this work is an anti-tamper/survival foundation. It must not be marketed as:

- impossible to stop
- hacker-proof
- always impossible to remotely control
- guaranteed 24/7 protection under every Android state

The truthful claim target is: LANERIQ continuously verifies its protection state, detects and surfaces unexpected loss of protection, restores when the platform permits, and fails closed in LANERIQ-controlled sensitive flows when protection integrity cannot be trusted.
