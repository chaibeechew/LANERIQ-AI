# LANERIQ Anti Scam — Privacy Policy Draft

Status: release-review draft. This file is a source-of-truth draft for the public privacy-policy page and store declarations; it is not yet a published legal page.

## Privacy-first design

LANERIQ Anti Scam is designed to protect users without turning protection into private-content surveillance. Security processing should occur on-device whenever practical. Cloud processing is limited to the minimum technical information required to provide threat reputation, protection integrity, abuse prevention, and service reliability.

## Data the product is designed not to collect by default

The default security telemetry path must not collect or upload raw private messages, passwords, authentication tokens, private keys, cookies, full browsing history, contacts, photos, videos, microphone audio, clipboard contents, or screen contents.

The Android privacy enforcement layer rejects forbidden or unknown private telemetry fields rather than silently accepting them.

## Security data that may be processed

Depending on the feature actually enabled and the final shipping implementation, the product may process privacy-minimized technical security data such as:

- hashed/normalized threat indicators, including domain or file fingerprints;
- app/package security metadata selected by the user for inspection;
- risk-level and protection-state summaries;
- Guardian heartbeat/integrity state;
- scoped pseudonymous installation identifiers;
- policy/reputation version and diagnostic reliability metadata;
- security-event summaries required for threat correlation, abuse prevention, or remediation.

Full files or other high-sensitivity samples must not be uploaded by default. Any future sample-upload capability requires a specific purpose, explicit user-facing disclosure/authorization where required, retention limits, and a separate release review.

## Web and VPN protection

A future system-wide Web Shield may use a user-consented platform VPN/network-filter capability. The product must disclose the VPN/security purpose before activation. VPN/network data must not be sold or used for unrelated advertising/profile-building. Network protection must collect no more information than required to identify and block security threats, operate the service, and investigate abuse or reliability incidents.

## Guardian and anti-tamper protection

The Guardian may inspect local technical security state such as protection heartbeat, notification availability, developer/ADB settings, Accessibility-related risk signals, installation/update events, and network-protection ownership where platform APIs permit it. These checks are security-state checks, not hidden monitoring of private messages, photos, microphone audio, or screen content.

## Data sharing

Security data may be shared only with service providers that are necessary to operate the security service, such as threat-reputation, malware-analysis, infrastructure, or reliability providers, and only under the minimum-data principle and applicable contractual/privacy requirements. User data is not sold for advertising.

## Retention

Production retention periods must be documented before public release. Local security events should be bounded. Cloud telemetry must use purpose-specific retention, deletion, access controls, regional/privacy requirements, and auditable policy. Release is blocked until the final retention schedule is approved and reflected in store declarations.

## Security

Production security controls are expected to include encryption in transit, controlled signing keys, least-privilege service identities, immutable/tamper-evident audit evidence where appropriate, staged rollouts, kill switches, and incident-response procedures.

## User controls

Users must be able to see whether Guardian/network protection is active, degraded, paused, or unverifiable. Features requiring platform consent must not be silently enabled. User-controlled settings changes are performed through approved operating-system flows.

## Children / sensitive audiences

The final store listing must declare the intended audience and any age-related requirements. This draft does not itself make a children-directed-service claim.

## Contact / controller details

Before public release, replace this section with the final legal entity/controller name, support contact, privacy contact, effective date, jurisdictional notices, and published privacy-policy URL.

## Release truth

This draft must be reviewed against the exact shipping binary and Google Play Data Safety / Apple App Privacy answers. Any difference between actual data behavior and this document blocks public release.
