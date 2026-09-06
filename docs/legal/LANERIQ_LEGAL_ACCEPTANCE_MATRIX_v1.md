# LANERIQ AI Legal Acceptance & Signature Matrix

**Version:** LANERIQ-LEGAL-MATRIX-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — LEGAL REVIEW REQUIRED BEFORE PRODUCTION ENFORCEMENT  
**Last Harmonized:** 2026-09-05

This Matrix defines the intended product-level acceptance strength for each legal document. It is an implementation control, not a substitute for legal review.

## 1. Acceptance levels

### Level A — Notice / acknowledgement

Used where the primary requirement is disclosure rather than contractual consent.

Evidence target:
- exact document/version served;
- timestamp;
- account/session where available;
- separate consent where consent is legally required.

### Level B — Clickwrap acceptance

Used for ordinary platform contractual terms.

Evidence target:
- authenticated account ID;
- exact document version/hash;
- affirmative unchecked-by-default `I Agree` action;
- timestamp;
- tamper-evident acceptance record.

### Level C — Strong electronic acceptance

Used for material commercial obligations.

Evidence target:
- all Level B evidence;
- legal/display name or authority confirmation appropriate to the transaction;
- project/order/agreement ID;
- final price or obligation snapshot;
- MFA/reauthentication appropriate to risk;
- immutable document hash;
- evidence that material terms were presented before acceptance.

### Level D — Bilateral electronic signature / transfer execution

Used for project ownership, copyright/IP assignment, major asset transfers or other transactions where written bilateral execution is critical.

Evidence target:
- Seller and Buyer authenticated separately;
- both signer identities/authority recorded privately;
- exact Agreement Version and hash;
- Project ID and Transaction ID;
- Asset Schedule hash;
- price/currency snapshot;
- affirmative signature act by each party;
- timestamp for each signer;
- MFA/reauthentication appropriate to risk;
- completion conditions and final status;
- tamper-evident audit history;
- Handover & Acceptance Certificate.

A photographed handwritten signature is not required for the standard LANERIQ workflow and must not be published in the public repository.

## 2. Document matrix

| Document / Policy | Intended level | Who accepts/signs | Production rule |
|---|---:|---|---|
| Privacy Notice | A / acknowledgement where required | User receives notice | Must be available before relevant collection; consent separate where legally required |
| Cookie / optional tracking consent | Separate consent | User | No pre-ticked optional consent; no advertising/cross-context tracking without separate approval |
| Device Compute Consent / Resource Use Notice | Separate explicit consent | Device/account user | Must not be bundled into ordinary Terms; withdrawal stops optional device compute |
| Platform Terms of Service | B | Account user | Required before contractual activation where legally required |
| Acceptable Use Policy | B, incorporated into Terms | Account user | Version linked to Terms acceptance |
| Refund/Cancellation Policy | B / checkout acknowledgement | Purchaser | Material refund rules shown before payment |
| Marketplace Terms | B | Marketplace Seller/Buyer | Required before listing/buying features |
| Buyout License | C | Project owner / authorized customer | Exact Project ID, tier, price/currency, License ID, terms version/hash; Customer stamp-duty allocation disclosed; stamp compliance remains separate manual review |
| Project Portability / Revenue Share Agreement | C | Project owner / authorized business signer | Exact Project ID, 10% version/definition, duration and reporting obligations; no hidden stacking with active Buyout |
| App Sale Asset Schedule | Level D attachment | Seller + Buyer | Final hash locked before sale signatures complete |
| App Sale & IP Assignment Agreement | D | Seller + Buyer | Written bilateral execution required for ownership/IP transfer; payment alone insufficient |
| App Sale Data Transfer Addendum | D when personal data transfers | Seller + Buyer and required business roles | Must complete before LANERIQ-assisted personal-data export |
| Handover & Acceptance Certificate | D completion evidence | Buyer acknowledgement + transaction system | Issued only after completion conditions and actual transfer evidence |
| Enterprise negotiated agreement | C or D based on scope | Authorized business signers | Separate authority verification required |
| Enterprise DPA | C or D as agreement requires | Authorized business signers | Roles/data scope/subprocessors/transfer terms must match actual Production data map |
| Operator successor-company novation/accession | C or D as counsel determines | Affected contracting parties where required | 1,000 users is readiness trigger only; no automatic novation |

## 3. High-risk actions requiring re-authentication

The following should require recent authentication and, when proportionate, MFA or another step-up control:

- signing App Sale/IP Assignment;
- accepting a material revenue-share obligation;
- activating a Buyout licence;
- transferring project ownership;
- exporting a customer/end-user personal-data dataset;
- changing payout destination for a pending marketplace sale;
- changing signer identity/business authority near completion; and
- approving a lawful reversal/reassignment of a completed App Sale.

## 4. Stamp-duty evidence boundary

Acceptance/signature strength does not determine whether an instrument is chargeable, exempt or duly stamped.

The acceptance system must not:

- mark an instrument `duly stamped` based on signature/payment alone;
- invent a stamp-duty classification/rate;
- auto-submit an instrument to HASiL; or
- auto-pay duty from a Customer or LANERIQ payment method.

The stamp-duty workflow remains **MANUAL REVIEW ONLY**.

Where a genuine stamping/adjudication process occurs, the private transaction record may store the official reference/status/certificate evidence separately from the signature ledger.

For Buyout, the Customer bears the intended stamping and filing cost as between the parties except where mandatory law allocates liability differently.

## 5. Evidence integrity

The acceptance system should store enough evidence to establish what the signer saw and approved without storing unnecessary sensitive data.

Recommended fields:

- acceptance/signature record ID;
- user/account ID;
- private signer legal-name/authority reference;
- actor role;
- agreement type;
- exact version;
- document hash;
- project/order/transaction ID;
- price/revenue-share/asset snapshot where relevant;
- timestamp in UTC;
- assurance/reauthentication event reference;
- completion state;
- superseded/revoked status where legally applicable; and
- audit-chain reference.

Do not place passwords, raw OTP values, full payment-card data, government ID images, handwritten signature images, private residential addresses or private authentication secrets in the public repository or ordinary acceptance evidence.

## 6. Contract presentation rules

For stronger enforceability and fairness, the product should:

1. show material commercial terms before the final acceptance action;
2. avoid pre-checked boxes;
3. make price, duration, renewal, revenue share, ownership transfer and non-refundable completed-service terms conspicuous;
4. show Buyout stamp-duty responsibility wording before Buyout acceptance;
5. prevent acceptance when required schedules are incomplete;
6. preserve the exact signed version/hash rather than silently replacing it with later text;
7. require renewed acceptance for material amendments where legally required;
8. provide an accessible copy/receipt after execution; and
9. provide a correction route for signer identity/authority errors before completion.

## 7. Personal operator privacy

Until a successor company transition is complete, the contracting operator is the individual identified in the private execution record, trading publicly as LANERIQ AI.

The public repository and ordinary user interface should not expose private residential address, government ID number, signature specimen, private banking details or unnecessary identity documents.

Legally required business/notice information must still be provided through an appropriate legal channel as advised by counsel.

## 8. 1,000-user transition trigger

Approximately 1,000 registered users is an internal operational trigger to begin successor-company readiness. It does not itself:

- create a company;
- transfer contracts or personal data;
- transfer licences;
- release the individual operator from accrued obligations; or
- require users to pay a second fee/revenue share.

## 9. Production legal Gate

No document marked DRAFT may be enforced as a final binding Production instrument solely because it exists in GitHub, passes CI or is deployed.

Before enabling enforcement, the release process must verify:

- qualified Malaysian legal review completed;
- final operator identity/notice details privately completed;
- governing law/dispute language approved;
- consumer-law review completed;
- PDPA/data-flow review completed;
- tax/stamp review completed where material;
- payment/refund terms aligned with actual processor role;
- exact final document version/hash frozen;
- acceptance/signature evidence implementation tested;
- legal pages reachable in Production; and
- runtime records preserve the exact accepted version/hash.

## 10. Statutory design notes for counsel

The final implementation should be checked against then-current Malaysian law including the Electronic Commerce Act 2006, Copyright Act 1987, Consumer Protection Act 1999, Stamp Act 1949 and Personal Data Protection Act 2010 as amended, plus current regulations, orders and Commissioner/HASiL guidance.
