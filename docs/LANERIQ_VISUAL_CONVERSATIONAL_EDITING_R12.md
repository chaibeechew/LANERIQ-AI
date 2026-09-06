# LANERIQ AI Visual Conversational Editing — Round 12

## User promise
The normal user does not operate a design tool. They generate an App/Website, open Preview, attach a screenshot or select an area, then say one sentence such as `左边加图`, `底部加 FAQ`, `这里换成更高级的图片`, or use voice. LANERIQ keeps the complexity internal.

## Pipeline
Screenshot/reference + one sentence → privacy-safe visual context → region resolution → edit-intent classification → semantic patch plan → responsive reconciliation → UI Complexity Budget → Visual Edit Judge → existing `/api/modify` security/version/quality/self-heal/save pipeline → updated Preview → repeat or rollback.

## Simplicity law
Complexity stays inside LANERIQ. Simplicity stays with the user.

Default UI budget per view:
- 1 primary action
- ≤5 top-level actions
- ≤6 primary navigation items
- ≤5 visible priority blocks in simple mode
- modal depth ≤1
- ≤1 critical decision
- no meaningless Bento, chatbot dominance or horizontal page overflow

Secondary/advanced controls must use progressive disclosure.

## Screenshot privacy
The reusable visual-edit record stores only an opaque screenshot ref and SHA-256 digest. Raw screenshot/image bytes, OCR text, raw prompt, secrets and customer payloads are not persisted in the R12 evidence/history layer.

## Safety boundary
Screenshot evidence never grants authority. Visual editing cannot self-grant admin roles, rewrite RLS/authorization, expose secrets, authorize billing, perform destructive Production actions, or bypass the existing saved-project ownership and expected-version checks. Ambiguous destructive/critical targeting fails closed and requires explicit target selection.

## Responsive editing
A request such as `左边加图` is semantic, not pixel cloning. Desktop can become a two-column split; tablet adapts when space allows; mobile becomes a single-column stack while preserving function and primary action.

## LIVE boundary
R12 CODE/CI can verify contracts, targeting rules and safe integration. It does **not** prove that a real multimodal provider has inspected a live screenshot. True Screenshot Understanding LIVE evidence requires a configured multimodal provider, a real request/response receipt, browser Preview evidence and the normal Production evidence ladder. Preview is not Production.

## Existing system reused
R12 intentionally reuses the existing `/api/modify` authority, project ownership, expectedVersion, idempotent request, zero-cost admission/credits, deterministic quality non-regression, Self-Heal, version save and rollback foundations. R12 is a visual-language front door, not a second modification authority.

SMS remains on hold. Mobile cross-user Community Compute remains disabled. Provider Router/server-independent architecture remains the default.
