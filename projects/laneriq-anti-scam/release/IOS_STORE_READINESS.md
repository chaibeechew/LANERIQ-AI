# LANERIQ Anti Scam — iOS App Store Readiness Contract

## Current product boundary

The existing iOS Anti Scam work is a separate Draft beta. It may provide iOS-appropriate features such as suspicious-link checks, selected-file fingerprinting, protection guidance, privacy controls and evidence-based safety states. It must not reuse Android-only claims such as unrestricted installed-app scanning or unrestricted system-wide antivirus visibility.

## Route A — Non-VPN iOS Anti Scam

A non-VPN App Store release may proceed only after all of these are verified for the exact shipping build:

- final production Bundle ID and Apple signing identity;
- physical-device/TestFlight validation;
- App Privacy answers matching actual data behavior;
- published privacy-policy URL;
- export-compliance review;
- crash/accessibility/performance review;
- store listing truth review;
- final main/source alignment and signed release artifact evidence.

## Route B — VPN / Network Protection iOS Anti Scam

If the shipping product offers VPN/network-protection service, the release must additionally satisfy the current Apple VPN-app requirements, including:

- approved Apple VPN/networking API usage (for example the applicable Network Extension / NEVPNManager path);
- Apple Developer Program enrollment status eligible for VPN-app distribution, including the organization requirement applicable to VPN apps;
- required entitlements/capabilities approved and present in the signed artifact;
- clear in-app disclosure before use of the VPN service describing data collection and use;
- privacy policy commitments compatible with Apple's VPN-data restrictions;
- territory/local-law/license review where applicable;
- real-device tunnel, handoff, failure and privacy tests.

## Truth boundary

The Android Guardian/Web Shield architecture is not evidence that iOS has the same system visibility. App Store copy must describe only the capabilities actually implemented and approved on iOS.

## Current launch truth

The iOS beta is not currently authorized as a public-production release. Route A and Route B remain blocked until their exact external evidence gates pass.
