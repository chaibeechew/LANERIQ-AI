# LANERIQ Anti Scam Companion Integration Contract

## Purpose

This contract prevents LANERIQ Anti Scam and LANERIQ AI App Builder from running duplicate device-security engines when both are installed.

## Ownership

`LANERIQ Anti Scam = Device Guardian Owner`

`LANERIQ AI App Builder = Security Consumer + In-App Security Client`

The App Builder may use LANERIQ cloud security services and show protection state, but it must not duplicate the standalone device Guardian.

## Required behavior

### If Anti Scam is installed and active

The App Builder must:

- consume companion protection status
- show `Protected by LANERIQ Anti Scam`
- use shared cloud intelligence for SafeLink, file/hash, build and publishing checks
- deep-link to Anti Scam for device-level remediation
- suppress any attempt to start a second LANERIQ security foreground service
- suppress any attempt to start a second LANERIQ security VPN

### If Anti Scam is installed but paused

The App Builder must:

- show `Protection paused`
- offer a user action to open Anti Scam
- continue only its own in-app/cloud checks
- not silently activate a competing Guardian

### If Anti Scam is not installed

The App Builder may:

- continue SafeLink and file/upload/publish security checks
- show `In-app & cloud protection active`
- offer the Anti Scam companion app

It must not claim device-wide or 24/7 protection.

## Android production contract

### Package visibility

The App Builder should query only the known Anti Scam production package using Android package visibility declarations. Broad package enumeration is not required for this companion check.

### Trusted status interface

Preferred production design:

- same publisher signing trust
- a signature-level permission such as `ai.laneriq.antiscam.permission.READ_PROTECTION_STATUS`
- a minimal read-only bound service/content provider/interface that exposes only:
  - Guardian enabled/paused state
  - last local risk level
  - last state timestamp
  - remediation deep-link intent

Do not expose raw private file content, browsing history, message content, credentials or unrelated device data through the companion interface.

### VPN rule

Only the Anti Scam app may own the LANERIQ device security VPN. The App Builder must never launch a competing LANERIQ VPN when Anti Scam is installed.

### Foreground-service rule

Only Anti Scam owns the persistent Guardian foreground service and persistent security notification.

## iOS production contract

Where Apple permits and both apps are signed by the same Developer Team:

- Anti Scam owns any approved Network Extension or related device-level security extension
- minimal protection state may be shared through an approved App Group/shared mechanism
- App Builder uses Universal Links or an approved URL scheme to open Anti Scam for remediation
- App Builder never represents itself as running full-device antivirus monitoring

## Shared cloud contract

Both apps may call the same LANERIQ Security Intelligence Cloud, but they must use separate client identities/scopes.

Every security event should include a deduplication key such as:

`device_installation_id + normalized_threat_fingerprint + event_window`

Cloud processing should be idempotent so the same threat seen by both apps does not create duplicate alerts or duplicate remediation records.

## Protection status priority

Display priority:

1. `Guardian Active` — verified local Anti Scam Guardian state
2. `Guardian Paused` — companion installed, local Guardian disabled
3. `Cloud/In-App Protection` — no verified local Guardian
4. `Protection State Unknown` — companion/cloud status cannot be verified

Truth Gate applies at every level. A lower evidence state must never be promoted to a stronger claim.

## User experience rule

The user should experience the two apps as one LANERIQ security ecosystem:

- Anti Scam = always-on device guardian
- AI App Builder = creation platform with built-in in-app/cloud security
- shared account and threat intelligence
- one device-level guardian
- one remediation path
- no duplicated background battery usage
- no duplicated VPN prompts
- no duplicated threat notifications
