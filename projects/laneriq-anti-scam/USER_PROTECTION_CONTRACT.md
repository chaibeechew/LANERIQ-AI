# LANERIQ Anti Scam — User Protection Contract

This contract defines non-negotiable product and engineering rules for LANERIQ Anti Scam.

## 1. Loss prevention before cleanup

LANERIQ should prefer preventing a harmful action before loss occurs rather than only reporting an incident afterward.

Required design direction:

- known malicious destinations should be blocked before navigation where the platform integration can enforce it
- high-risk phishing destinations should be warned/blocked according to evidence
- sensitive banking/payment actions inside LANERIQ-controlled surfaces must fail closed when high remote-control/web-risk evidence is present
- DNS/VPN/network protection must remain opt-in and platform compliant
- unknown/low-observed-risk destinations must never be described as guaranteed safe

## 2. App / APK / file risk scanning

LANERIQ should help users assess apps and files using the strongest evidence the platform permits.

Evidence layers may include:

- local SHA-256 fingerprint
- package metadata and signing information where available
- requested-permission / install-source risk signals
- local reputation cache
- trusted cloud reputation
- dedicated scanner evidence
- sandbox/behavior evidence on supported platforms

Truth rules:

- permission risk alone is not a virus verdict
- a hash alone is not a clean verdict
- no `virus-free` / `CLEAN` claim without sufficient scanner evidence
- Android/iOS platform restrictions must be surfaced rather than hidden

## 3. Anti-remote-control and anti-monitoring protection

LANERIQ should make unauthorized remote control and scam-assisted control paths significantly harder and should interrupt high-risk sensitive flows early.

Technical risk signals may include, where the OS permits:

- unknown Accessibility services
- suspicious overlay state
- screen-sharing / remote-support state
- ADB / developer-state changes
- device-admin changes
- recently installed unknown/sideloaded software
- banking/payment context combined with remote-control signals

Truth rules:

- LANERIQ must not promise that external control is absolutely impossible
- risk signals should be correlated; one weak signal alone should not be treated as proof of compromise
- when multiple strong signals occur during a sensitive action, LANERIQ-controlled flows should fail closed and show urgent disconnect guidance

## 4. Privacy First

Protection must not turn into surveillance.

Default rules:

- local-first security decisions whenever practical
- no raw private message upload by default
- no password, cookie, auth-token, private-key or clipboard collection for ordinary threat telemetry
- no full browsing-history upload by default
- no contact-list upload by default
- no photo/video/microphone monitoring for threat telemetry
- no hidden screen-content monitoring
- no cross-user community compute on mobile
- cloud telemetry uses minimized threat fingerprints, pseudonymous device identifiers and bounded technical risk features
- raw samples/private content require explicit, purpose-limited user action and a separate consent path if ever needed

The Guardian may monitor local technical security state required for protection. It must not monitor private user content merely to build behavioral profiles.

## 5. Truth Gate

The product must distinguish:

- `blocked due to known malicious evidence`
- `high risk / review required`
- `no high-risk signal found in this check`

These are not interchangeable.

Prohibited default claims include:

- 100% safe
- guaranteed protection
- impossible to hack/control
- virus-free without scanner evidence
- banking safe without dedicated banking evidence

## 6. Platform boundary

Android, iOS and desktop capabilities differ.

- Android can support stronger device-level Guardian, package/file assessment and network/DNS/VPN protection with user permission and OS-policy constraints.
- iOS cannot provide unrestricted system-wide antivirus scanning. iOS protection must use the capabilities Apple actually allows and must not imitate Android claims.
- Desktop can support deeper endpoint behavior, ransomware and file-system protection through a separate endpoint agent architecture.

## 7. Current implementation truth

The current Android test project includes Guardian reliability work, local Safe Web heuristics, user-selected file/APK SHA-256 fingerprinting, local Developer/ADB/Accessibility risk checks and a Privacy Center.

This is not yet equivalent to a full production malware scanner, deployed global reputation service, system-wide DNS/VPN blocker, or guaranteed remote-control prevention. Those remain evidence-gated implementation stages.
