# LANERIQ Anti Scam iOS Beta

Standalone SwiftUI beta client for LANERIQ Anti Scam on iPhone/iPad.

## Current beta capabilities

- SafeLink local phishing-risk heuristics.
- User-selected file SHA-256 fingerprinting through the iOS document picker.
- LANERIQ Production Truth status.
- Banking Safety guidance and fail-closed security messaging.
- Privacy-first design: no raw selected file is uploaded by this beta.

## Truth / platform boundaries

- No sufficient scanner evidence => no CLEAN claim.
- A normal App Store iOS app does not have unrestricted system-wide file/process scanning privileges.
- This beta does not claim guaranteed theft prevention, unrestricted background malware scanning, or BANKING_SAFE without sufficient evidence.
- Network Extension / DNS filtering / advanced device-management capabilities require separate Apple entitlements and are not silently assumed.

## Build

The project is generated with XcodeGen:

```bash
cd apps/laneriq-security-ios
xcodegen generate
xcodebuild \
  -project LANERIQSecurityBeta.xcodeproj \
  -scheme LANERIQSecurityBeta \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## iPhone installation

A simulator build cannot be installed on a physical iPhone. Physical-device distribution requires Apple code signing. For TestFlight, configure an Apple Developer Team, App Store Connect app record, distribution signing credentials, and an archive/upload workflow for bundle id `ai.laneriq.security.ios.beta`.
