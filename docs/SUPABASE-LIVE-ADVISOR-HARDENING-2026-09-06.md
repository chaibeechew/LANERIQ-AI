# LANERIQ AI Supabase LIVE Advisor Hardening — 2026-09-06

This document records the current production evidence boundary. It is not a substitute for LIVE re-verification after migrations are applied.

## Security

- Three Admin-only `SECURITY DEFINER` RPCs remain executable by `authenticated` in the current Production database. PR #373 introduces the staged service-role-only v2 path.
- Four authenticated `SECURITY DEFINER` RPCs are intentionally retained as reviewed self-service endpoints because they derive identity from `auth.uid()` and constrain access to the caller's own resources.
- `sign_project_migration_agreement` remains API-disabled pending qualified legal review and a server-only signing path.
- Supabase Auth leaked-password protection is currently reported disabled by the LIVE security advisor. Global Production completion must remain blocked until it is enabled through Supabase Auth configuration and the LIVE advisor no longer reports the warning.

## Performance

The LIVE performance advisor reports eight foreign keys without covering indexes around Creator Support and Buyout License. This PR adds only those eight additive indexes. Existing indexes are not removed merely because they currently show as unused.

## Evidence rule

After deployment, re-run both Supabase Security and Performance Advisors and record the exact Production main SHA plus LIVE database results. Code/CI success alone does not close these findings.
