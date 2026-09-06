# Android P0 Migration

This directory is the standalone LANERIQ Anti Scam Android product track for P0 Guardian Reliability Foundation.

The first migration imports the isolated Guardian prototype from `test/laneriq-antivirus-apk-20260905` into the new product boundary. The prototype is not Production and does not prove 24/7 device-wide antivirus protection.

P0 engineering now present in this branch:

- standalone test identity `ai.laneriq.antiscam.test`
- Guardian foreground-service skeleton with explicit user opt-in
- boot/package-update restore request path where Android permits
- package install/update awareness with local deduplication
- Protection Truth state machine
- 90-second local Protection Lease with heartbeat/expiry
- bounded local event log
- power-save/thermal-aware Guardian cadence
- Guardian truth-state unit tests
- dedicated P0 Android build/test workflow

Current gate: branch CI and on-device evidence are still required before any 24/7 device-protection claim is allowed.
