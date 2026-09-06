# LANERIQ AI Canonical UI Source of Truth

Status: active canonical customer UI authority.

## Authority model

LANERIQ AI now separates **internal product capability contracts** from **customer-facing UI authority**.

Customer-facing route, navigation and stage authority comes from:

- `lib/product/canonical-ui-registry.js`
- `app/components/CanonicalCoreUIOwner.js`
- `app/components/LIUIRealProductSurface.js`
- `app/components/LIUIContextIntelligence.js`
- `app/canonical-core-ui.css`
- `app/liui-real-product-surface.css`
- `app/liui-canonical-product-surface.css`
- `app/components/LaneriqLotusBrand.js`
- `app/laneriq-lotus-brand.css`

The historical `lib/product/laneriq-18-page-master.js` may remain as an internal capability, safety and compatibility contract. It is **not** customer UI authority and must never force a fixed total-page presentation back into runtime.

## Canonical core journey

`Home → Login → Enter Email → Verification Code → Create`

Routes:

- Home: `/`
- Login: `/login`
- Enter Email / Verification Code: `/auth`
- Create / Build Progress: `/create`

`CanonicalCoreUIOwner` owns the shared core header, account entry, primary bottom navigation and safe-area behavior. The core journey is isolated from the workspace LIUI shell so two global shells cannot style or mount over the same route.

## Canonical workspace shell

The route registry also owns Projects, Templates, Preview, Launch, Manage, AI Assistant, Automation, Analytics, Editor, Database, Testing, Publish and related account/media surfaces.

`LIUIRealProductSurface` owns workspace chrome only when the route is not part of the core journey. It provides:

- canonical workspace header
- left project rail on larger screens
- five-destination mobile navigation
- contextual Creation Journey stages where appropriate
- current-workspace context for non-journey tools

The canonical primary navigation is always:

`Home / Projects / Create / Templates / More`

The canonical Creation Journey is:

`Idea / Plan / Build / Preview / Launch / Manage`

These are semantic destinations and stages, **not a fixed total-page wizard**.

## Non-negotiable UI rules

1. Customer UI must not present fixed product totals such as 18, 23 or 25 pages.
2. `Page n of 18/23/25`, the old 18-step strip and the old master-layout customer panel are retired.
3. Core routes must not receive workspace `data-liui-surface` styling or workspace chrome.
4. Workspace routes must not mount a second global `AccountNav` over canonical profile chrome.
5. Route-local Header/Nav elements must not compete with canonical global chrome.
6. Floating global overlays must stay off Home, Login, Auth and Create unless explicitly integrated into the canonical layout.
7. `LaneriqLotusBrand` is the canonical brand source.
8. `/laneriq-future-city-people.webp` is the canonical shared visual source for the core journey unless a future approved canonical design replaces it.
9. Mobile inputs remain at least 16px where keyboard zoom is a risk; primary touch targets remain at least 44px.
10. Top/bottom safe areas, `100svh`, horizontal overflow protection and reduced-motion behavior are release contracts, not optional polish.
11. UI refactors must preserve real generation, session, ownership, workflow, database, testing and publish engines and their truth boundaries.
12. UI owner does not merge Production. Production Release Control owns final integration and exact-SHA release verification.

## CSS loading and ownership

`app/template.js` is the final shared presentation boundary for the canonical core shell. `canonical-core-ui.css` remains the final shared stylesheet there so older feature/theme layers cannot silently override the protected core journey.

`app/layout.js` loads the workspace LIUI shell and canonical product surface layers. The retired `liui-complete-18-page-surface.css` must remain deleted.

Auth has one base stylesheet plus the canonical final layer. The removed duplicate files below must not be restored:

- `app/auth/auth-living-intelligence.css`
- `app/auth/auth-lotus-brand-override.css`

## Regression gates

`.github/workflows/canonical-ui-source-of-truth.yml` runs `scripts/canonical-ui-source-of-truth-tests.mjs` and blocks restoration of the old customer shell.

Historical workflow names containing `18-Page` may remain for Production Release Control compatibility, but their customer-UI assertions must validate the canonical registry/surfaces. They must not require fixed page totals, the retired 18-step strip, or the deleted legacy stylesheet.

The regression contract verifies, among other things:

- canonical registry ownership
- Home/Login/Auth/Create core isolation
- workspace/core shell separation
- canonical lotus branding
- canonical five-destination navigation
- no fixed 18/23/25 page totals
- no old master-layout restoration
- no duplicate Auth override files
- no duplicate global account chrome on canonical-owned surfaces
- safe-area and horizontal-overflow protection
- touch/input mobile constraints
- real creation/editor/database/testing/publish engine preservation
- truthful external provider/device/store evidence boundaries

## Integration lock

Every feature PR must rebase or realign against latest `main` before integration. If a feature branch touches global UI, Canonical UI wins and the feature adapts to it. An old branch must never restore an older Home, Auth, Logo, Navigation, global CSS, page-count presentation or shared shell.

Production UI is not complete until Production Release Control separately verifies:

`GitHub main exact SHA = Vercel Production exact SHA = Runtime verified SHA`

Preview and CI evidence are necessary but do not substitute for that Production equality check.
