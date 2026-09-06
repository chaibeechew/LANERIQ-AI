# LANERIQ Anti Scam

**Status:** Standalone LANERIQ security product project

**Parent brand:** LANERIQ

**Product role:** Always-on anti-scam, malware-risk, phishing, banking-risk and emergency-response companion for Android and iOS, with shared LANERIQ Security Intelligence Cloud services.

## Product boundary

LANERIQ Anti Scam is the **single owner of device-level protection** when installed. LANERIQ AI App Builder may expose security checks and a Protection Status surface, but it must not start a second Always-On Guardian, second device VPN, or duplicate device-level monitor.

This project follows a **one Guardian, many LANERIQ clients** architecture:

- **LANERIQ Anti Scam:** owns local device Guardian, OS-level risk sensors, persistent protection notification, install/update watch, local hash/rule checks, optional network protection where the platform permits it, Banking Safety and Emergency Response.
- **LANERIQ AI App Builder:** keeps in-app SafeLink, upload/file risk checks, publishing/build safety checks and a companion status surface. It calls shared cloud intelligence and, when LANERIQ Anti Scam is installed, reads the companion protection state instead of starting another device Guardian.
- **LANERIQ Security Intelligence Cloud:** shared threat intelligence, URL/domain reputation, file/hash reputation, policy/rules, model inference, evidence/truth state and cross-product alert correlation.

## No-conflict rule

When both products are installed:

1. LANERIQ Anti Scam remains the **Device Guardian Owner**.
2. AI App Builder shows `Protected by LANERIQ Anti Scam` and uses the companion contract.
3. AI App Builder does not start a second foreground security service or VPN.
4. Security events are deduplicated before cloud upload.
5. If Anti Scam is paused or unavailable, AI App Builder falls back to **cloud/in-app checks only** and must not claim 24/7 protection.

## Local vs cloud

Always-on protection cannot be cloud-only. Device-local signals such as app install/update events, Accessibility state, Developer/ADB state, overlay/remote-control indicators, local file hashing and foreground protection status must be observed locally where the OS permits it. Cloud services enrich those signals with reputation, threat intelligence and policy decisions.

## Platform truth boundary

- **Android:** can support an explicit user-enabled foreground Guardian and other platform-permitted sensors. Some advanced capabilities require additional permissions and Google Play policy review.
- **iOS:** cannot provide unrestricted full-device antivirus scanning. iOS protection must use Apple-permitted app sandbox, network-extension/content-filter capabilities (when entitled/approved), SafeLink/file checks, shared intelligence and companion status without claiming full system antivirus coverage.

## Current migration source

The existing Android test client and iOS beta were prototyped inside `chaibeechew/LANERIQ-AI`. Migration into this standalone project must be verified before any Production cutover. Existing Production remains unchanged until release gates pass.

See `ARCHITECTURE.md` and `INTEGRATION_CONTRACT.md` for the authoritative ownership and coexistence rules.
