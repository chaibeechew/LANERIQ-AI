# LANERIQ AI Production Legal Approval Gate

**Version:** LANERIQ-LEGAL-GATE-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — RELEASE CONTROL POLICY; DOES NOT ITSELF CREATE BINDING CUSTOMER TERMS  
**Last Harmonized:** 2026-09-05

This document defines the minimum evidence required before LANERIQ AI may turn a legal draft into a binding Production self-service document.

## 1. Default state

All legal documents marked DRAFT, LEGAL REVIEW REQUIRED, PRIVACY REVIEW REQUIRED, TAX REVIEW REQUIRED or equivalent remain **NON-BINDING PRODUCT DRAFTS** until this Gate is satisfied for the exact document/version/hash.

A file existing in GitHub, a successful CI run, a Vercel deployment, a Supabase migration or an AI-generated draft does not constitute legal approval.

## 2. Mandatory hierarchy

Activation must preserve the legal hierarchy defined by the current Legal Corpus Manifest:

1. mandatory applicable law/non-excludable rights;
2. exact specific executed agreement;
3. Platform Terms;
4. incorporated policies/notices;
5. internal operational guidance.

No internal policy may silently rewrite an already executed agreement or override mandatory statutory liability.

## 3. Required approvals

Before a document/version becomes binding, the private legal-release record must identify as applicable:

- exact document key/name;
- exact semantic version and immutable SHA-256 content hash;
- current LANERIQ contracting party;
- qualified Malaysian legal reviewer and approval date/reference;
- privacy/DPO review where personal-data obligations are material;
- tax/stamp-duty review where instrument duties/tax allocation are material;
- payment/marketplace compliance review where LANERIQ handles funds or regulated services;
- product owner approval;
- Production Release Control approval; and
- effective/activation date.

Private legal opinions, identity documents and signature specimens must not be placed in the public repository.

## 4. Current Malaysian baseline that must be checked before activation

The final reviewer must confirm the then-current position, including at least:

- Electronic Commerce Act / electronic contracting requirements;
- Copyright Act written-form requirements for copyright assignment/licensing;
- Consumer Protection Act and other non-excludable consumer rights;
- Stamp Act 1949 instrument classification, section 33/Third Schedule statutory payer and current stamping/penalty rules;
- HASiL e-Invoice implementation/exemption rules based on actual taxpayer facts;
- Personal Data Protection Act 2010 as amended, including current DPO, DBN, registration, cross-border and automated-decision/profiling guidance;
- marketplace/payment/escrow/KYC/AML/licensing triggers based on LANERIQ's actual transaction role; and
- current operator-to-successor-company transition mechanics.

The 2026-09-05 drafting baseline is recorded in the Legal Corpus Manifest but must be rechecked if activation occurs later.

## 5. Acceptance UX evidence

Before activation, the product must demonstrate that the signer/user sees or can access the exact applicable terms before acceptance and that the correct acceptance strength is used.

Evidence should include as applicable:

- notice/acknowledgement for Privacy;
- clickwrap for ordinary Platform Terms;
- strong electronic acceptance for Buyout and Revenue Share;
- bilateral written electronic execution for App Sale/IP assignment;
- exact version/hash;
- timestamp;
- authenticated account/signer evidence;
- Project ID / Transaction ID / License ID where relevant;
- MFA/reauthentication for high-risk actions; and
- tamper-evident audit history.

No photographed handwritten signature is required merely to satisfy this product Gate.

## 6. Stamp-duty truth gate

LANERIQ must not represent any instrument as duly stamped unless genuine official evidence supports that statement.

Production stamp-duty automation remains disabled. The default mode is **MANUAL REVIEW ONLY**.

For Buyout, the legally approved final terms may allocate the relevant stamp-duty cost to the Customer as between the parties, except where mandatory law allocates liability differently.

No final legal document may state or imply:

- every electronic agreement is exempt;
- every Buyout has a fixed stamp rate;
- LANERIQ automatically files/pays duty; or
- electronic acceptance/payment itself satisfies stamping.

## 7. Privacy truth gate

Before activation, the Production data map must be reconciled against the exact Privacy/DPA text.

The reviewer must specifically assess current DPO triggers, including regular/systematic monitoring; the breach-notification operational clock; controller/processor roles; registration obligations; retention; cross-border transfers; subprocessors; and the actual device/analytics behavior.

The approximately 1,000-user company-transition threshold must never be used as a substitute for DPO/PDPA applicability analysis.

## 8. Marketplace transaction gate

General self-service App sales remain disabled until the approved package covers at least:

- Marketplace Terms;
- App Sale & IP Assignment Agreement;
- Asset Schedule;
- third-party/open-source disclosure process;
- Data Transfer Addendum when personal data moves;
- Seller Verification/KYC Rules;
- IP Notice & Takedown Procedure;
- refund/chargeback process;
- tax/stamp-duty process; and
- Handover/Acceptance Certificate.

No sale may be represented as legally completed solely because payment succeeded.

Actual ownership-transfer completion must correspond to the real project ownership state and immutable transfer evidence.

## 9. Buyout gate

Before Buyout self-service activation, the exact Buyout terms must clearly disclose:

- exact Project ID;
- price/tier/currency;
- project-specific scope;
- 0% intended future LANERIQ revenue share after effective Buyout;
- no hidden stacking with the 10% portability path for the same post-Buyout revenue;
- Customer stamp-duty cost allocation subject to mandatory law;
- no automatic stamping/payment by LANERIQ; and
- no automatic transfer of Buyout status to a later project buyer unless the final legally approved transfer mechanism expressly permits it.

## 10. Current individual operator

Until a lawful successor-company transition is completed, the contracting operator remains the individual identified in the private contracting-party record, publicly trading as LANERIQ AI where appropriate.

Approximately 1,000 registered users is a **readiness trigger only**. It does not automatically novate agreements, transfer liabilities, change bank/tax identity or replace the controller/operator.

## 11. Zero-cost staging rule

LANERIQ may prepare documents, version controls, hashes, acceptance schemas, manual review queues and compliance checklists using the existing GitHub/Vercel/Supabase architecture without purchasing new compliance SaaS.

Paid legal review, statutory duties, company registration, regulated KYC/AML, specialist e-signature or escrow/payment tooling should be activated only when legally/commercially required and separately approved.

Zero-cost preference must never be used to bypass mandatory legal obligations.

## 12. Release states

Each legal module must use one of these states:

- `DRAFT`
- `LEGAL_REVIEW_REQUIRED`
- `LEGAL_APPROVED`
- `APPROVED_NOT_ACTIVE`
- `ACTIVE`
- `SUPERSEDED`
- `RETIRED`
- `SUSPENDED`

Only an exact `ACTIVE` version may be used for new binding self-service acceptance.

Historical executed agreements must remain linked to their exact accepted version/hash unless a valid amendment/novation mechanism provides otherwise.

## 13. Change control

A material legal change requires a new version and assessment of whether existing users need notice, fresh acceptance or bilateral amendment.

Production Release Control must verify that the deployed effective text exactly matches the approved version/hash. A later draft commit must not silently replace the terms users accepted.

## 14. Final Production evidence

A legal module may be announced as Production-active only when:

**approved legal version/hash = GitHub main legal version/hash = deployed Production legal version/hash = runtime acceptance version/hash**

and the relevant legal/privacy/tax/payment/product approvals are complete.

This exact-legal-version rule supplements the broader LANERIQ requirement that GitHub main exact SHA, Vercel Production exact SHA and verified runtime SHA must reconcile before Production completion is claimed.
