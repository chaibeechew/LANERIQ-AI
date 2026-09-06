# LANERIQ Anti Scam — Android Production Signing Contract

## Purpose

This document defines the release-signing boundary for the production Android application id `ai.laneriq.antiscam`.

## Non-negotiable rules

1. Debug/test builds may use the normal Android debug key and the `.test` application-id suffix.
2. Public production artifacts must never be signed with the debug key.
3. Production signing/upload key material must not be committed to Git, placed in source files, pasted into issues/PRs, or exposed in build logs.
4. CI must reference secret names only. Secret values are configured in the authorized CI/Play Console environment.
5. The final public artifact must have its signing certificate fingerprint recorded as signed release evidence.
6. The production signing identity must remain continuous across releases. Unexpected certificate changes block release.
7. Key rotation/recovery requires an explicit audited procedure and fresh release evidence.

## Expected secret interface

The release workflow may consume only environment/secret references with these logical names:

- `LANERIQ_ANDROID_UPLOAD_KEYSTORE_B64`
- `LANERIQ_ANDROID_UPLOAD_KEY_ALIAS`
- `LANERIQ_ANDROID_UPLOAD_STORE_PASSWORD`
- `LANERIQ_ANDROID_UPLOAD_KEY_PASSWORD`

The workflow must decode the keystore only into an ephemeral runner path, use it for the release build, and securely remove the temporary file when the job ends. No secret value may be echoed.

## Release artifact evidence

A production artifact is not considered verified until all of the following are attached to the same release evidence record:

- source commit SHA
- application id = `ai.laneriq.antiscam`
- version code/name
- AAB SHA-256
- signing certificate SHA-256 fingerprint
- CI run/proof reference
- timestamp
- trusted verifier identity

## Current truth

The repository currently supports structural release-AAB generation for CI. That is not equivalent to a production-signed artifact. Until approved signing/upload-key custody is configured and verified, `productionSignedArtifactVerified` must remain false.
