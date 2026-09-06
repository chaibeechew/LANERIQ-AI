# LANERIQ Anti Scam — Store Readiness 2026

Policy review date: 2026-09-06.

This file is a release checklist, not legal advice and not proof of store approval. Store policies may change; re-check the official sources immediately before submission.

## Google Play — Android

Official references:
- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- VpnService: https://support.google.com/googleplay/android-developer/answer/12564964
- Permissions / sensitive APIs: https://support.google.com/googleplay/android-developer/answer/16558241
- Device and Network Abuse / foreground services: https://support.google.com/googleplay/android-developer/answer/16559646

### Required for a new mobile app submission now

- New apps and updates must target Android 16 / API 36 or higher from 2026-08-31.
- Release identity must be the production package (`ai.laneriq.antiscam`), not the `.test` package.
- Android 14+ foreground-service use must declare a valid FGS type and corresponding Play Console information. `specialUse` requires a truthful user-benefit justification and review evidence.
- If/when LANERIQ enables `VpnService`, the Play Console VpnService declaration is required.
- Device-security apps are an allowed VpnService category when the use is genuinely necessary for the core security function.
- VpnService use must be documented in the Play listing.
- Any personal/sensitive data accessed or collected through VPN functionality requires prominent disclosure and explicit consent.
- Data sent from device to a VPN tunnel endpoint must be encrypted.
- VPN traffic must not be redirected/manipulated for monetization.
- Data Safety and privacy disclosures must match the actual release build and all third-party SDK/provider behavior.
- Broad app visibility / sensitive permissions must be minimized and declared only if genuinely necessary for core functionality.

### Current LANERIQ source state

- API 36 migration: implemented in source; CI evidence pending.
- Production/test package separation: implemented in source; CI evidence pending.
- Real system-wide VpnService Web Shield: NOT implemented/verified yet. Current truth remains `MANUAL_CHECK_ONLY`.
- Play VpnService declaration video/form: external Play Console task; not completed by source code.
- FGS `specialUse` declaration/review video: external Play Console task; not completed by source code.
- Production signed AAB / upload-key custody: not yet verified.
- Real-device/OEM/soak evidence: not yet verified.

## Apple App Store — iOS

Official references:
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Encryption documentation: https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation

### VPN/security requirements that materially affect LANERIQ

- Apps offering VPN services must use Apple's approved VPN APIs such as `NEVPNManager` / approved Network Extension capabilities.
- Apple guideline 5.4 states VPN apps may only be offered by developers enrolled as an Organization.
- Before use/purchase of the VPN service, the app must clearly disclose what user data is collected and how it is used.
- VPN apps must commit in the privacy policy not to sell, use, or disclose VPN data to third parties for other purposes.
- Territory-specific VPN licensing requirements must be respected and, where required, provided in App Review Notes.
- App Store Connect requires a privacy policy URL and accurate App Privacy data-handling answers, including third-party partners.
- Encryption/export-compliance questions must be completed where applicable.

### Current LANERIQ iOS state

- Existing iOS Anti Scam work is still a Draft beta PR, not a production standalone release.
- Existing beta bundle id remains `ai.laneriq.security.ios.beta`.
- Production signing/TestFlight/App Store submission evidence is not complete.
- A VPN-enabled iOS release is additionally blocked until Organization enrollment / Apple approval requirements are satisfied.
- A non-VPN iOS release can be evaluated separately, but it must not claim Android-style system-wide antivirus/Web Shield capabilities.

## Release decision rules

### Internal test
May proceed only after CI passes and an installable signed test artifact exists.

### Closed test
May proceed only after internal-test gates plus real-device smoke tests and privacy/disclosure review.

### Public production
Must remain BLOCKED until all five LANERIQ release layers have their external evidence and store-specific requirements are complete.

No GitHub merge, store upload, TestFlight/App Store/Play production submission, or marketing claim is authorized merely because this checklist exists.
