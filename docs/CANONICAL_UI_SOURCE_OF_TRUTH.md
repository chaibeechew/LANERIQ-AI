# LANERIQ AI Canonical UI Source of Truth

Status: active from UI Cleanup Round 1.

## Ownership

The canonical customer-facing UI owner is the combination of:

- `app/components/CanonicalCoreUIOwner.js`
- `app/canonical-core-ui.css`
- `app/components/LaneriqLotusBrand.js`
- `app/laneriq-lotus-brand.css`

For the first cleanup group, the protected journey is:

`Home → Login → Enter Email → Verification Code → Create`

Routes:

- Home: `/`
- Login: `/login`
- Enter Email / Verification Code: `/auth`
- Create: `/create`

## Round 1 rules

1. Customer UI must not present fixed product totals such as 18, 23 or 25 pages.
2. Legacy 18-page context/master-layout presentation is not customer UI authority. Internal registry semantics may remain until migrated, but customer-facing counters/master-layout panels are suppressed.
3. The canonical core journey uses `LaneriqLotusBrand` for brand identity and `/laneriq-future-city-people.webp` for the shared core background source.
4. Header, account entry, safe-area handling and primary bottom navigation on Home/Create are owned by `CanonicalCoreUIOwner`.
5. Core CTA geometry and visual treatment are normalized in `canonical-core-ui.css`.
6. No Production merge is performed by the UI owner. Changes are delivered through a UI PR and then handed to Production Release Control.

## CSS loading priority

`app/template.js` is the final presentation loading boundary for shared UI overlays. The current order is intentional:

1. historical/feature stylesheets
2. brand lock / lotus refresh
3. runtime safe-area fixes
4. **`canonical-core-ui.css` last**

The canonical stylesheet must remain the final shared stylesheet in `app/template.js`. This allows Round 1 to converge the five core pages without rewriting unrelated product pages in the same PR.

## Legacy stylesheet policy

Legacy global stylesheets are not automatically deleted in Round 1 because some still serve non-core pages. They are non-authoritative for the protected core journey. Future cleanup rounds may remove them only after their remaining selectors are mapped and browser-verified.

The following legacy UI concepts are specifically non-authoritative for customer presentation:

- 18-page master layout labels
- fixed `Page n of 18/23/25` counters
- duplicate auth visual overrides that conflict with the canonical final layer
- route-local chrome that collides with the canonical header or bottom navigation

## Restoration guard

`.github/workflows/canonical-ui-source-of-truth.yml` runs `scripts/canonical-ui-source-of-truth-tests.mjs` on UI changes. The guard verifies:

- the canonical stylesheet remains loaded last
- the canonical owner remains mounted
- Home/Login/Auth/Create remain registered in the owner
- the lotus brand source remains connected
- old master-layout/page-counter customer presentation remains suppressed
- top/bottom safe-area handling remains present
- Login continues to Email Verification and returns to Create

Any branch that restores an older UI must first pass this canonical guard and must not make legacy presentation authoritative again.
