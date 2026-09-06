# LANERIQ Anti Scam Architecture

## 1. Core principle

**One device = one LANERIQ Device Guardian owner.**

The standalone LANERIQ Anti Scam app owns device-level persistent protection. Other LANERIQ apps consume its status and shared cloud intelligence rather than duplicating the same low-level engine.

## 2. Runtime layers

### A. Device Protection Layer — local, standalone Anti Scam only

Android responsibilities, where platform policy and permissions allow:

- Always-On Guardian foreground service
- boot restore after user opt-in
- package install/update event watch
- Developer Options / ADB risk signals
- Accessibility-enabled risk signal and review guidance
- local file/APK fingerprinting
- local URL heuristics and cached reputation
- Banking Safety escalation
- emergency response workflow
- future: permission/overlay/remote-control risk correlation
- future: user-enabled VPN/DNS protection

The Device Protection Layer is the only component allowed to own a persistent security foreground service or a LANERIQ security VPN on the same device.

### B. LANERIQ App Security SDK / Companion Layer

Used by LANERIQ AI App Builder and future LANERIQ apps:

- check whether the standalone Anti Scam companion is installed and active
- retrieve a minimal protection-state summary through a same-publisher trusted contract
- submit SafeLink/file/hash checks to shared cloud services
- deep-link users to Anti Scam for device-level remediation
- never duplicate the Device Guardian

### C. Security Intelligence Cloud — shared

Shared services provide:

- URL/domain reputation
- phishing/scam intelligence
- file/hash reputation
- threat intelligence feeds
- policy/risk scoring
- evidence/truth state
- model inference
- privacy-preserving telemetry aggregation
- event deduplication and correlation

The cloud can enrich and coordinate protection, but it cannot replace local observation of time-sensitive device events.

## 3. Coexistence state machine

### State 1 — Anti Scam installed + Guardian active

AI App Builder displays:

`Protected by LANERIQ Anti Scam`

Behavior:

- device-level monitoring: Anti Scam
- cloud checks: shared
- AI App Builder: in-app protection only
- no duplicate VPN
- no duplicate persistent service

### State 2 — Anti Scam installed + Guardian paused

AI App Builder displays:

`LANERIQ Anti Scam installed — protection paused`

Behavior:

- do not silently start a second guardian
- offer `Open Anti Scam` / `Resume Protection`
- continue cloud/in-app checks
- do not claim Always-On protection

### State 3 — Anti Scam not installed

AI App Builder displays:

`In-app & cloud protection active`

Behavior:

- SafeLink/file/upload/publish checks continue
- no device-wide protection claim
- optionally offer the standalone Anti Scam companion

## 4. Android coexistence design

Production target identities should be distinct, for example:

- Anti Scam: `ai.laneriq.antiscam`
- AI App Builder: its existing LANERIQ app package

Recommended trusted cross-app contract:

- package-specific visibility query only; avoid broad `QUERY_ALL_PACKAGES`
- signature-level custom permission for status access
- same-publisher signing trust
- small read-only companion status interface
- deep link for user-authorized actions

VPN ownership rule:

- LANERIQ Anti Scam is the only LANERIQ product allowed to own the security `VpnService`.
- AI App Builder never starts a competing VPN.

Notification rule:

- persistent Guardian notification belongs to Anti Scam
- App Builder uses ordinary in-app banners/status cards only

## 5. iOS coexistence design

iOS apps are sandboxed, so the architecture must remain Apple-compliant.

Recommended model for apps signed by the same Apple Developer Team:

- LANERIQ Anti Scam owns any approved Network Extension / content filtering capability
- optional App Group or approved shared-state mechanism stores minimal last-known protection state
- Universal Links / URL schemes open the companion app for remediation
- AI App Builder does not attempt to duplicate system-level monitoring

If Apple does not permit a given entitlement, the feature is omitted or reduced rather than represented as active.

## 6. Conflict-prevention rules

1. Single writer for Device Guardian state.
2. Single LANERIQ security VPN owner.
3. Client-specific cloud credentials and scopes.
4. Shared event IDs for cloud deduplication.
5. Idempotent scanning APIs.
6. No duplicate push/alert for the same correlated threat event.
7. Anti Scam owns remediation; App Builder links to it.
8. Truth Gate prevents a product from claiming protection that is unavailable on the current platform or permission state.

## 7. Product wording

Allowed when Guardian evidence exists:

- `Always-On Guardian Active`
- `Protected by LANERIQ Anti Scam`
- `Monitoring device risk signals`

Fallback wording when only cloud/in-app checks exist:

- `In-app & cloud protection active`
- `Device Guardian not active`

Never infer `CLEAN`, `100% protected`, or guaranteed theft prevention without sufficient evidence.
