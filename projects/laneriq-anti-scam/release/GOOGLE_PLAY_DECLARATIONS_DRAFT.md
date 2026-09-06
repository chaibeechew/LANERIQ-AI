# LANERIQ Anti Scam — Google Play Declarations Draft

Status: submission draft. Final answers must match the exact shipping binary and Google Play Console forms.

## App identity

- Product: LANERIQ Anti Scam
- Production application id: `ai.laneriq.antiscam`
- Primary category intent: device security / anti-scam / threat protection
- Current release-candidate baseline: Android 16 / target API 36

## VpnService declaration — future Web Shield

### Primary purpose

LANERIQ Anti Scam intends to use Android `VpnService` only for a user-enabled security function: system-wide malicious-site / phishing / threat-domain protection and related network security enforcement.

### User benefit

The network-protection layer is designed to interrupt known-malicious or sufficiently evidenced high-risk destinations before the user continues into a scam/phishing flow. It is not intended to provide unrelated consumer VPN location-masking or advertising profiling.

### Consent and disclosure requirements

Before the VPN/network filter is activated, the shipping app must:

1. explain the security purpose in clear language;
2. explain what network/security information is processed;
3. state what is not collected by default;
4. obtain Android's required VPN consent through the platform flow;
5. provide a visible protection-state indicator and a user-controlled disable path;
6. fail closed on protection claims if tunnel ownership/health cannot be verified.

### Data handling

The shipping implementation must minimize network telemetry. It must not sell VPN/network data or use it for unrelated advertising/profile-building. Any data transmitted from the device must be encrypted in transit. Raw full browsing history is prohibited by the LANERIQ privacy contract.

### Current truth

The release-candidate source currently keeps `System-Wide Web Shield` at `MANUAL_CHECK_ONLY`. Public release with an Active Web Shield is blocked until a real `VpnService` data plane, consent flow, IPv4/IPv6/handoff tests, ownership verification, signed threat-reputation ingestion and false-positive benchmarks are complete.

## Foreground Service `specialUse` declaration

### Current service

`GuardianService` uses a user-enabled foreground Guardian to maintain a fresh local protection heartbeat and observe permitted technical security-state signals needed for anti-scam protection integrity.

### Why foreground execution is user-beneficial

The Guardian needs timely lifecycle/protection-integrity state so LANERIQ can stop claiming protection when the service is stale/offline, detect degraded alert delivery, restore after supported lifecycle events, and surface correlated risk. It is not a hidden background surveillance service.

### Privacy boundary

The Guardian does not by default read/upload private messages, photos, microphone audio, contacts, screen content, passwords, cookies, auth tokens or full browsing history. The project CI blocks broad surveillance permissions by default.

### User control

The Guardian is explicit opt-in. The persistent notification is visible. Ordinary one-tap notification shutdown has been removed to reduce remote-abuse risk; the user can intentionally pause Guardian inside the app, with extra Android device-credential step-up during elevated-risk states.

## Data Safety working map

The final Google Play Data Safety form must be generated from the exact production implementation. The current intended data categories are:

### Not collected by default

- Contacts
- Photos/videos
- Audio recordings
- Private messages
- Passwords/auth tokens/private keys/cookies
- Clipboard contents
- Full browsing history
- Screen contents

### Potentially processed for app functionality/security

- App/package security metadata selected for inspection
- Hashed/normalized threat indicators
- Scoped pseudonymous installation/security identifiers
- Guardian/protection integrity state
- Security-event summaries
- App diagnostics/reliability metadata
- Policy/reputation version metadata

Whether a category is classified by Google Play as collected, shared, ephemeral, optional or required must be determined from the final production data flow and provider contracts. This draft intentionally does not pre-fill a false answer.

## Before Play submission — required final evidence

- final public privacy-policy URL;
- final Data Safety answers reviewed against binary/network traces;
- VpnService declaration if the shipping binary includes/enables VpnService;
- foreground-service declaration/justification for the exact manifest;
- production AAB signed by approved upload/signing path;
- Play App Signing configuration evidence;
- target API/permissions/SDK review;
- app content/target audience/content rating/ad policy answers;
- store listing screenshots/copy that do not overclaim `CLEAN`, `virus-free`, `hacker-proof`, `BANKING_SAFE`, guaranteed theft prevention or unsupported system-wide protection;
- closed-test / production access requirements satisfied for the account type in use;
- latest Google Play policy review on submission date.
