# LANERIQ Security Fabric V2

## Goal

Make LANERIQ Anti Scam the single device-security authority while allowing LANERIQ AI App Builder and future LANERIQ products to consume the same protection without duplicate VPNs, foreground services, scans, alerts, or battery cost.

## 1. Four-layer model

### Layer A — Device Guardian Owner

Owned only by the standalone LANERIQ Anti Scam app.

Responsibilities:

- Always-On Guardian lifecycle
- device risk sensors
- APK/app install-update risk review
- local URL/file/hash checks
- permission / Accessibility / ADB / Developer / future overlay-remote-control correlation
- Banking Safety escalation
- emergency remediation workflow
- single LANERIQ VPN / DNS protection owner when enabled
- one persistent device-protection notification

Rule: one device/user profile must have only one LANERIQ Device Guardian owner.

### Layer B — LANERIQ Security Broker

A small trusted local broker exposed by Anti Scam to other LANERIQ apps.

Responsibilities:

- return verified Guardian state
- accept low-risk security requests from LANERIQ client apps
- return normalized local risk verdicts
- expose remediation/deep-link actions
- enforce caller identity, scopes and rate limits
- deduplicate requests from multiple LANERIQ apps

The broker is not a second scanning engine. It is the single local coordination point.

### Layer C — Embedded Security SDK

Each LANERIQ product embeds a lightweight SDK, not a full Guardian.

Example consumers:

- LANERIQ AI App Builder
- future LANERIQ browser/workspace apps
- future LANERIQ desktop/mobile companions

SDK responsibilities:

- detect whether Anti Scam / Security Broker is available
- securely read protection state
- submit link/file/build/publish risk requests
- fall back to in-app/cloud checks when the Guardian is absent
- never start a competing device VPN or persistent Guardian
- display truthful protection wording based on evidence

### Layer D — LANERIQ Security Intelligence Cloud

Shared cloud brain for all LANERIQ products.

Responsibilities:

- URL/domain reputation
- phishing/scam intelligence
- file/hash reputation
- threat intelligence feeds
- risk scoring/model inference
- policy/Truth Gate state
- privacy-preserving telemetry
- threat correlation and deduplication
- account/device trust graph where permitted

Cloud enriches local decisions but never replaces local time-sensitive observation.

## 2. Conflict-free coexistence

### Anti Scam installed + Guardian active

AI App Builder and other LANERIQ apps:

- use the Security Broker
- use shared cloud intelligence
- show `Protected by LANERIQ Anti Scam`
- suppress all duplicate Guardian/VPN behavior

### Anti Scam installed + Guardian paused

Client apps:

- show `Protection paused`
- keep in-app/cloud checks
- offer `Resume in LANERIQ Anti Scam`
- never silently create a second Guardian

### Anti Scam absent

Client apps:

- keep embedded SDK checks for their own content and workflows
- use Security Intelligence Cloud
- show `In-app & cloud protection active`
- never claim device-wide or 24/7 protection

## 3. Android implementation contract

Production target:

- Anti Scam package: `ai.laneriq.antiscam`
- AI App Builder: existing LANERIQ package

Broker trust:

- same-publisher signing certificate
- custom signature-level permission
- explicit component binding only
- minimal read-only state surface by default
- authenticated/scoped request surface for scans

Suggested permission:

`ai.laneriq.antiscam.permission.USE_SECURITY_BROKER`

Suggested broker response fields:

- guardian_state
- guardian_version
- last_risk_level
- last_state_timestamp
- vpn_state
- network_protection_state
- remediation_intent
- evidence_level

Do not expose raw browsing history, raw private files, messages, credentials or unrelated device data.

VPN ownership:

- Anti Scam is the sole LANERIQ `VpnService` owner.
- Client apps must never create a competing LANERIQ VPN.
- If another vendor VPN is active, LANERIQ must detect/communicate the conflict rather than silently replacing it.

## 4. iOS implementation contract

Because iOS apps are sandboxed, use a companion architecture rather than Android-style service binding.

Where permitted and both apps are signed by the same Apple Developer Team:

- Anti Scam owns approved Network Extension / packet tunnel / filtering capabilities
- App Group shares minimal non-sensitive protection state
- Keychain access group shares credentials/installation trust tokens where appropriate
- Universal Links / URL scheme opens Anti Scam for remediation
- App Builder performs only in-app/cloud checks

No iOS product may claim unrestricted full-device antivirus scanning when the platform does not expose that capability.

## 5. Guardian election and ownership lock

Even inside LANERIQ, device-level ownership must be explicit.

Create a local ownership record:

- owner_product = LANERIQ Anti Scam
- owner_installation_id
- owner_version
- owner_last_heartbeat
- vpn_owner
- guardian_state

Client apps treat the record as authoritative only when it is cryptographically tied to the LANERIQ publisher identity and fresh enough to trust.

If ownership cannot be verified, clients fall back to `Protection State Unknown` or in-app/cloud state rather than claiming protection.

## 6. Shared threat event envelope

All LANERIQ apps should normalize security events into one envelope:

- event_id
- device_installation_id
- source_product
- source_surface
- threat_fingerprint
- risk_level
- evidence_level
- event_time
- correlation_window
- remediation_state

Recommended deduplication key:

`device_installation_id + threat_fingerprint + correlation_window`

This prevents one threat from generating duplicate notifications through Anti Scam and AI App Builder.

## 7. User experience

The ecosystem should feel like one security system:

- Anti Scam = device guardian
- AI App Builder = creation app with embedded security
- Security Broker = local coordinator
- Security Intelligence Cloud = shared intelligence brain

Example App Builder status:

- `Protected by LANERIQ Anti Scam — Guardian Active`
- `LANERIQ Anti Scam installed — Protection Paused`
- `In-app & cloud protection active — Device Guardian not installed`
- `Protection state unknown — verify LANERIQ Anti Scam`

## 8. Battery and performance policy

Avoid two products polling the same state independently.

Preferred behavior:

- Guardian performs device-level monitoring once
- Broker publishes state changes
- client apps read on demand or subscribe to minimal state notifications where platform rules permit
- cloud correlation deduplicates repeated events
- expensive scans are coalesced and cached by content hash / threat fingerprint

## 9. Failure model

Fail closed on security claims, not necessarily on product availability.

Examples:

- Broker unavailable -> client uses in-app/cloud protection and marks Guardian unknown
- Cloud unavailable -> local Guardian continues local monitoring and cached reputation
- Guardian paused -> no Always-On claim
- VPN conflict -> clearly surface conflict and preserve user control
- stale state -> downgrade evidence state

## 10. Product boundary

LANERIQ Anti Scam remains a standalone product with independent Android/iOS releases and store listings.

LANERIQ AI App Builder keeps an Anti Scam/Security surface, but that surface is a client/portal into the LANERIQ Security Fabric rather than a duplicate device-security engine.

This model is the preferred long-term architecture for coexistence, scalability, battery control, platform compliance and future LANERIQ product expansion.
