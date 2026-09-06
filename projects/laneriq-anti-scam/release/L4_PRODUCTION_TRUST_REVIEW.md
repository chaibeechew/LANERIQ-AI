# LANERIQ Anti Scam — L4 Production Trust Review

Status: **PRE-DEPLOYMENT / PUBLIC PRODUCTION BLOCKED**

This review records the live infrastructure facts observed while the Anti Scam branch is still Draft. It does not authorize a production migration or release.

## Approved current Supabase target

- Project name: `LANERIQ AI`
- Project ref: `uyizbmajxcvtkgzuoykg`
- Region: `ap-southeast-1`
- Observed project health: `ACTIVE_HEALTHY`
- Anti Scam Dead-Man migration: **NOT DEPLOYED from this Draft branch**

The production migration workflow is intentionally restricted to exact `main`, the `anti-scam-production` GitHub Environment, explicit project/region/retention confirmation, and a secret-only Postgres URL.

## Anti Scam Dead-Man security contract

The proposed Dead-Man storage is intentionally narrow:

- one current row per scoped HMAC installation pseudonym;
- no raw stable device identifier is stored;
- no URL, message body, filename, contacts, photos, video, microphone data, screen content, credentials, authentication tokens or private keys;
- app/device attestation and Android Keystore Witness proof are both required before admission;
- unknown heartbeat fields are rejected;
- trusted ingress, request-size and region/residency admission are required;
- epoch/sequence replay rejection is durable in PostgreSQL;
- per-install durable heartbeat admission is limited to no faster than 15 seconds while the normal client cadence remains 60 seconds;
- `anon` and `authenticated` receive no table or Dead-Man RPC access;
- only `service_role` receives the three storage RPC privileges;
- exact deletion exists;
- scheduled retention purge exists, with a 30-day application policy and a 1–90 day code bound;
- public Production remains blocked until deployment evidence is signed and bound to the exact release source/artifact.

## Live Supabase advisor findings observed before Anti Scam deployment

The following findings pre-existed the proposed Anti Scam migration and must not be misattributed to Anti Scam code:

1. **Leaked Password Protection is disabled — WARN.** This is an account/authentication hardening item and remains an L4 production-trust review blocker until explicitly accepted or remediated.
2. **Several existing `SECURITY DEFINER` functions are executable by `authenticated` — WARN.** These belong to existing LANERIQ platform surfaces. They require a separate least-privilege review; Anti Scam must not silently change unrelated business authorization semantics.
3. **Several existing tables report `RLS enabled, no policy` — INFO.** Some private/service-only tables may intentionally rely on no client policy, so each must be classified rather than mechanically adding permissive policies.
4. **Performance advisor currently reports primarily unused-index INFO findings.** These are not evidence of an Anti Scam bottleneck and should not be removed solely because they are currently unused without workload evidence.

## L4 release decision rules

A reviewer must reject L4 Production if any of the following is true:

- the migration is executed from a branch other than exact current `main`;
- the target project ref or region differs from the approved values above;
- database connection credentials are committed, printed, or supplied through non-secret inputs;
- `anon` or `authenticated` can read/write the Dead-Man table or execute its service RPCs;
- retention/deletion is absent or untested;
- regional admission settings are absent;
- app attestation is disabled or a self-asserted package identity is accepted;
- Witness signature/replay verification is bypassed;
- private-content fields are accepted;
- the live Supabase security advisor is not reviewed again after the migration;
- unresolved account/platform WARN findings are silently treated as PASS.

## Required post-deployment evidence

After an approved deployment from exact `main`:

1. run the migration workflow and preserve its immutable GitHub run ID/source SHA;
2. verify RLS and all three RPC privilege boundaries against the live database;
3. run Supabase Security Advisor and Performance Advisor again;
4. validate monotonic replay/rate-limit behavior without using private user data;
5. validate exact deletion and retention purge against test pseudonyms only;
6. exercise a real attested Android heartbeat in the approved region;
7. prove cloud outage leaves local Guardian truth and cached evidence fail-closed;
8. sign the resulting L4 evidence with an approved release-evidence key before L4 can become `READY`.
