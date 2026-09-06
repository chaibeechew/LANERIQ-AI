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

The Control Tower live evaluator currently checks:

- GitHub `main` SHA availability.
- Runtime build SHA availability.
- Runtime environment (`production`, `preview`, etc.).
- Exact GitHub-main/runtime SHA equality.
- GitHub combined commit status.
- Supabase runtime configuration presence.

A Preview deployment never becomes `PRODUCTION VERIFIED`, even if its SHA happens to match `main`.

## Management data model

The staged additive migration introduces:

- `control_tower_releases`
- `control_tower_workstreams`
- `control_tower_items`
- `control_tower_release_gates`
- `control_tower_audit_log`

All tables use RLS. Owner, Super Admin and Admin are the only authenticated roles allowed to access Control Tower data. Audit-log writes are append-only from authenticated Control Tower admins; update/delete grants are not provided.

## Admin management APIs

Protected APIs now exist for:

- `GET/POST /api/admin/control-tower/releases`
- `GET/POST /api/admin/control-tower/workstreams`
- `GET /api/admin/control-tower/status`

When the migration is not yet active in an environment, the management board reports storage as pending instead of exposing a broken customer surface.

## CI contract

A path-scoped Control Tower workflow verifies:

- route-level authentication/authorization hooks;
- private/no-store API response behavior;
- live release-truth invariants;
- RLS/audit migration presence;
- release/workstream input validation;
- Preview cannot be promoted to Production by SHA equality alone.

## Rollout plan

### Phase 1 — Foundation — implemented in Draft PR

- Protected `/admin/control-tower` route.
- Central internal-role helper.
- Initial Control Tower information architecture.
- No customer navigation changes.

### Phase 2 — Management data model — staged in Draft PR

- Release trains, workstreams, items and release gates.
- RLS and least-privilege policies.
- Append-only audit log.
- Release and workstream create/list APIs.
- Admin management board that activates when storage migration is present.

### Phase 3 — Live integrations — partially implemented

Implemented:
- GitHub main identity.
- Runtime/Vercel build identity from deployment environment.
- Exact-SHA release truth evaluation.
- GitHub combined commit status.
- Supabase runtime configuration presence.

Next:
- PR-level evidence and workflow summaries per release.
- Vercel deployment history/target evidence per release.
- Supabase migration-version evidence rather than configuration presence only.
- Security, benchmark and release-gate rollups.

### Phase 4 — Automated release governance

- Gate evaluation.
- Blocked dependency alerts.
- Release scorecards.
- Production promotion only after required evidence passes.

### Phase 5 — Public projection

- Generate customer-safe release notes and status views from internal release data.
- Never expose internal roadmap, security detail, provider costs, secrets or unreleased work.

## Integration rule

This work remains isolated in its Draft PR until concurrent workstreams settle. Before Production integration, rebase/realign to the latest `main`, rerun all relevant CI, then follow Production Release Control. Do not call the Control Tower Production merely because its Preview is READY.
