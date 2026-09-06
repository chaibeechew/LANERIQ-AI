# Supabase Auth Global Production Blocker

## Leaked password protection

Production Supabase Security Advisor currently reports `auth_leaked_password_protection` as WARN: leaked password protection is disabled.

LANERIQ AI must not mark Global Production Complete while this warning remains unresolved.

### Closure requirements

1. Enable Supabase Auth leaked-password protection for the Production project `uyizbmajxcvtkgzuoykg` through an authorized Supabase Auth configuration surface.
2. Re-run the LIVE Supabase Security Advisor.
3. Confirm `auth_leaked_password_protection` is absent from the returned WARN findings.
4. Record the verification alongside the current exact GitHub main / Production runtime release identity.

The connected Supabase actions available to this release-control session do not expose an Auth configuration mutation, so this document and the Production Closure policy intentionally record the blocker without claiming it has been enabled.

Revalidation note (2026-09-06): PR #373 was re-triggered after PR #374 merged so its checks are evaluated against the latest `main` merge context before A1 integration.
