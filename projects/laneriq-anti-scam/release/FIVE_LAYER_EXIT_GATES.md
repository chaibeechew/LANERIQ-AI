# LANERIQ Anti Scam — Five-Layer V1 Exit Gates

These are the fixed V1 completion gates. New ideas must fit inside one of these layers instead of creating unlimited new top-level layers.

## L1 — Real-Time Interception

Purpose: stop known or strongly evidenced scam destinations before loss, without turning protection into surveillance.

Exit evidence required:
- Android 16 / API 36 production build passes unit, lint and release bundle compilation.
- Production package identity is `ai.laneriq.antiscam`; test builds remain isolated under `.test`.
- Real user-consented Android `VpnService` / network-filter implementation exists before claiming system-wide Web Shield.
- Single LANERIQ VPN owner is enforced; VPN conflicts are surfaced, never silently replaced.
- IPv4, IPv6, DNS, Wi-Fi/mobile handoff, captive portal, reconnect, reboot/update and revoke-consent behavior is tested.
- Signed threat-reputation ingestion reaches Android; local cache cannot self-manufacture `KNOWN_MALICIOUS`.
- Known-malicious test corpus is blocked before navigation.
- Heuristic-only high risk uses an interstitial and cannot be relabeled as known malicious.
- False-positive benchmark is measured on a representative benign-site corpus.
- Play VpnService disclosure/declaration evidence exists before public release if VpnService ships.

Until these pass: `System-Wide Web Shield = MANUAL_CHECK_ONLY`.

## L2 — Malware / App Risk Efficacy

Purpose: let users inspect apps/APKs/files using defensible evidence, not permission-count theater.

Exit evidence required:
- Trusted file/app reputation provider path.
- Trusted scanner and/or sandbox/behavior provider path.
- Signed provider evidence adapter reaches Android verdict logic.
- App signer, package, source, permission, Accessibility, Device Admin, overlay and remote-control capability evidence remains local-first where possible.
- Malicious benchmark corpus includes representative Android malware/scamware families and new/unknown samples where legally obtainable.
- Benign corpus includes popular signed apps, banking apps, productivity apps and edge cases.
- False-positive rate, false-negative rate, time-to-verdict and provider failure behavior are measured.
- Provider outage degrades to `UNKNOWN/REVIEW`, never `CLEAN`.
- `virus` classification requires class-specific evidence; generic malware evidence cannot invent a virus label.

Until these pass: local metadata may produce REVIEW/HIGH_RISK, not a strong malware-free or virus verdict.

## L3 — Guardian Survival + Real Device Evidence

Purpose: prove the Guardian behaves correctly under real Android lifecycle and attack-adjacent conditions.

Exit evidence required:
- user Pause vs unexpected process/service loss classification verified on device.
- UI task removal verified while Guardian remains active.
- process kill / OS reclamation behavior verified.
- true Force Stop boundary verified; no false automatic-recovery claim.
- user-reopen recovery creates a new lease epoch/session before Protected returns.
- reboot, USER_UNLOCKED and package update restore paths verified.
- background FGS restrictions and denied starts fail closed without crash-loop.
- notification disabled/channel blocked is surfaced as alert-delivery degradation.
- battery saver, background restriction and severe thermal states measured.
- signer/install-source continuity behavior tested across legitimate updates and mismatch simulations.
- >=24 hour soak with heartbeat continuity, restart count, battery and temperature evidence.
- representative OEM matrix: at minimum Pixel plus Samsung and several aggressive-background vendors (for example Xiaomi/Oppo/Vivo equivalents available to the test program).
- AI App Builder + Anti Scam coexistence verifies one Guardian, signature-permission Witness, key continuity, anti-replay and no private-content sharing.

Until these pass: anti-tamper is a hardened foundation, not `impossible to stop` or `hacker-proof`.

## L4 — Production Trust + Cloud

Purpose: make cloud assistance useful without creating a privacy or control-plane single point of failure.

Exit evidence required:
- Cloud Dead-Man endpoint deployed with privacy-safe Guardian facts only.
- device identifiers are scoped pseudonyms; raw stable cross-region identifiers are not used as general analytics IDs.
- retention, deletion, rate limit, abuse prevention and regional privacy controls are documented and tested.
- production signing/upload keys use controlled custody (HSM/KMS/hardware-backed or equivalent documented operational control).
- release-evidence public keys are pinned; arbitrary self-signed evidence cannot make a release gate pass.
- policy/rule rollout uses canary stages, kill switch and emergency rollback.
- immutable/tamper-evident audit storage records policy and rollout decisions.
- cloud outage leaves local Guardian and cached evidence functioning within their truthful scope.
- no raw message/password/token/private key/contact/photo/video/microphone/screen-content telemetry enters ordinary threat telemetry.

Until these pass: cloud/security-control-plane claims remain test/development only.

## L5 — Production Scale + Store Release

Purpose: prove the exact release artifact, infrastructure and store declarations are ready for public users.

Exit evidence required:
- feature branch aligned to latest `main`; all required CI rerun on the aligned exact SHA.
- Android release bundle produced and signed with approved upload/release process; artifact digest recorded.
- Google Play target API, FGS, VpnService (if present), Data Safety, privacy policy and required declaration/video review are complete.
- multi-region active/active deployment has measured SLO and failover evidence for the scale being claimed.
- staged capacity ladder is evidence based: 1K -> 10K -> 100K -> 1M -> 10M -> 100M -> 1B; claims stop at the last independently passed stage.
- load, latency, error rate, headroom, cost and soak gates pass for each claimed stage.
- no production rollout skips canary or kill-switch readiness.
- Production Release Control verifies exact artifact/source/runtime identity before announcing Production.

### iOS additional gate

If shipping VPN capability on iOS:
- Apple-approved Network Extension / NEVPNManager implementation is required.
- Apple Developer enrollment/approval must satisfy the Organization requirement for VPN apps.
- App Privacy, privacy policy and encryption/export-compliance answers must match the build.
- iOS may not claim unrestricted Android-style system scanning.

Until these pass: public production remains BLOCKED, while internal/closed testing may proceed when their smaller channel-specific gates pass.
