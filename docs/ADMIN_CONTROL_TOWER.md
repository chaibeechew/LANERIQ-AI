# LANERIQ AI Admin Control Tower

## Architecture decision

LANERIQ AI remains one application and one codebase. Customer-facing and internal-admin experiences are separated by route, role and authorization policy rather than by maintaining two independent products.

- Customer surfaces: normal product routes, public release notes and service status.
- Internal surfaces: `/admin/*`, protected by server-side authentication and role checks.
- Control Tower: `/admin/control-tower`.

This avoids duplicate product logic, duplicated deployments and configuration drift while keeping internal controls inaccessible to ordinary users.

## Access layers

1. Owner / Super Admin
   - Full Control Tower, release, security, cost, provider, incident and production controls.
2. Admin / Internal Team
   - Assigned workstreams, release tasks, verification and operational admin tools.
3. Support / Operations
   - Support-safe user/service information only; no secrets, source, raw security findings or provider credentials.
4. Customer
   - Product version, entitlements, release notes, available features and public status only.

## Program structure

`Vision → Product Line → Capability Layer → Release Train → Workstream → Epic → Feature → PR → Verification Evidence → Production`

## Delivery state machine

`Idea → Planned → Ready → In Progress → Code Complete → Verification → Release Candidate → Production → Observed → Closed`

Code Complete is never equivalent to Production.

## Control Tower modules

- Master Roadmap
- Current Release
- Next Release
- Backlog
- Workstreams
- Dependency Graph
- Release Gates
- Risk Register
- Decision Log
- Deprecated Registry
- Evidence Center

## Version model

Track four identities independently:

- Product Version — customer-facing generation, e.g. `LANERIQ AI 2.0`
- Release Version — engineering release, e.g. `v2.4.1`
- Capability Level — product intelligence maturity
- Build Identity — immutable build/deployment/Git SHA evidence

Page or route count is not a product version.

## Product-surface registry rule

Do not hard-code total page counts in customer UI. A future Product Surface Registry should classify and count:

- Main User Pages
- Feature Pages
- Auth Pages
- Admin Pages
- Dynamic Routes
- Internal Pages

Customer UI should describe the current workflow/stage rather than expose a fixed total page ceiling.

## Release truth gate

Production completion requires exact build identity verification across release sources. A feature may not be marked Production merely because code was merged or a deployment is READY.

## Rollout plan

### Phase 1 — Foundation

- Protected `/admin/control-tower` route.
- Central internal-role helper.
- Initial Control Tower information architecture.
- No customer navigation changes.

### Phase 2 — Management data model

- Release trains, workstreams, items, dependencies, risks, decisions, deprecated assets and evidence records.
- RLS and least-privilege policies.
- Immutable audit trail for sensitive admin actions.

### Phase 3 — Live integrations

- GitHub PR / commit state.
- Vercel deployment and exact-SHA evidence.
- Supabase migration/runtime verification.
- CI, security, benchmark and release-gate summaries.

### Phase 4 — Automated release governance

- Gate evaluation.
- Blocked dependency alerts.
- Release scorecards.
- Production promotion only after required evidence passes.

### Phase 5 — Public projection

- Generate customer-safe release notes and status views from internal release data.
- Never expose internal roadmap, security detail, provider costs, secrets or unreleased work.
