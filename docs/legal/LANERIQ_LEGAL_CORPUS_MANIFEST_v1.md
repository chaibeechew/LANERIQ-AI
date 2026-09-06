# LANERIQ AI Legal Corpus Manifest

**Corpus Version:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Review Date:** 2026-09-05  
**Status:** LEGAL_REVIEW_REQUIRED — NOT ACTIVE / NOT BINDING BY THIS FILE ALONE  
**Base Repository SHA:** `afc4f4d08af0af5ef236c507c5c4388130a5317e`

This Manifest is the authoritative drafting index for the current LANERIQ AI legal corpus. It harmonizes the existing legal documents, the Buyout stamp-duty policy decision, and the Malaysian regulatory baseline verified on 2026-09-05.

## 1. Legal hierarchy

For drafting and runtime conflict resolution, apply this order:

1. mandatory applicable law and non-excludable statutory rights;
2. the exact, specifically executed agreement governing the transaction or project;
3. the Platform Terms of Service;
4. incorporated policies, notices and operational procedures;
5. internal implementation guidance.

A contractual allocation of cost or responsibility must not be represented as overriding a person who is mandatorily liable under applicable law.

## 2. Current policy decisions

### 2.1 Buyout

For an eligible project with an active Buyout License:

- Personal: US$49;
- Business: US$199;
- Enterprise: US$499;
- intended future LANERIQ AI revenue share after effective Buyout: 0% for that licensed project, subject to the final legally approved terms;
- the Buyout is project-specific and does not transfer LANERIQ platform technology, provider accounts, credentials or unrelated proprietary technology;
- the Buyout does not automatically transfer to a later App buyer unless a legally approved transfer/assignment mechanism expressly permits it.

### 2.2 Buyout stamp duty

As a commercial cost allocation, the Buyout Customer is intended to bear stamp duty, adjudication, filing, payment and related government charges attributable to the Buyout instrument, except to the extent mandatory applicable law allocates liability to another person.

LANERIQ AI must not automatically calculate, classify, adjudicate, file, submit, stamp, pay or debit any payment method for Malaysian stamp duty. Production mode is **MANUAL REVIEW ONLY**.

Electronic signing, payment success, a LANERIQ certificate or a document hash must never be represented as proof that an instrument is duly stamped.

### 2.3 Non-Buyout projects

A project without an active eligible Buyout License may remain subject to the Project Portability / Revenue Share Agreement before full external migration. The current draft commercial rate is 10% of defined Project Software Revenue. An active eligible Buyout must not be silently combined with the same 10% post-Buyout revenue-share obligation for the same project revenue.

### 2.4 Marketplace App Sale

LANERIQ is the platform/workflow/evidence provider unless it separately signs as a transaction principal. Payment alone is not legal completion. App Sale/IP assignment requires the final transaction package, bilateral execution, transfer conditions and actual ownership-transfer evidence.

LANERIQ must not call itself an escrow provider unless a separately approved regulated escrow/payment arrangement actually exists.

## 3. Verified Malaysian regulatory baseline — 2026-09-05

### 3.1 Stamp duty

Current HASiL operational guidance states that:

- the person liable to pay duty for an instrument is determined by section 33 and the Third Schedule to the Stamp Act 1949;
- as a general rule, a chargeable instrument executed in Malaysia should be stamped within 30 days after execution; an instrument executed outside Malaysia generally has a 30-day period after first receipt in Malaysia;
- current late-stamping penalty guidance provides RM50 or 10% of deficient duty, whichever is higher, for the first late-stamping tier, and RM100 or 20%, whichever is higher, for later cases;
- an instrument is classified by its legal substance, not merely its title.

These rules are an operational legal baseline, not authority for LANERIQ to auto-classify a Buyout, Revenue Share or App Sale instrument.

### 3.2 e-Invoice

HASiL's implementation timeline was updated on 30 August 2026. The current public timeline states that taxpayers with annual turnover/revenue below RM3,000,000 are exempt from e-Invoice implementation, subject to the then-current detailed rules and eligibility conditions. This exemption does not eliminate ordinary tax, accounting or recordkeeping obligations.

LANERIQ must not purchase or activate an e-Invoice automation product merely on the assumption that it is legally required at the current stage. Actual turnover, taxpayer status and then-current rules must be assessed.

### 3.3 Malaysian PDPA

The Personal Data Protection Act 2010, as amended in 2024, and the Commissioner's current circulars/guidelines require ongoing assessment. Current DPO guidance states that a data controller or processor must appoint one or more DPOs where processing involves any of these conditions:

- personal data exceeding 20,000 data subjects;
- sensitive personal data, including financial information, exceeding 10,000 data subjects; or
- regular and systematic monitoring of personal data, including online user-behaviour tracking.

Therefore LANERIQ must not assume that being below 20,000 users automatically means no DPO obligation.

Current Data Breach Notification guidance states that a qualifying breach must be notified to the Commissioner as soon as practicable and no later than 72 hours from occurrence, with the operational clock assessed from the facts of the incident. LANERIQ must preserve occurrence/detection/confirmation/assessment timestamps rather than hard-code a universal `confirmation + 72h` rule.

Data-controller registration, DPO registration and sector/class registration are separate legal questions and must not be conflated.

### 3.4 Copyright / App Sale

Under section 27(3) of the Copyright Act 1987, an assignment of copyright or licence of a controlled act has no effect unless it is in writing. LANERIQ therefore treats App Sale/IP Assignment as a written, bilateral, exact-version transaction document with strong electronic execution evidence.

## 4. Current document set

The current harmonized corpus consists of:

- Platform Terms of Service;
- Privacy Notice;
- Acceptable Use Policy;
- Cookie & Tracking Notice;
- Refund / Cancellation / Chargeback Policy;
- Buyout License;
- Project Portability / Revenue Share Agreement;
- Marketplace Terms;
- App Sale & IP Assignment Agreement;
- App Sale Asset Schedule;
- App Sale Data Transfer Addendum;
- App Sale Handover & Acceptance Certificate;
- Electronic Signature & Acceptance Evidence Standard;
- Legal Acceptance & Signature Matrix;
- Enterprise Data Processing Addendum;
- Marketplace Seller Verification & KYC Rules;
- IP Notice & Takedown Procedure;
- Tax & Stamp Duty Operations Policy;
- Operator Successor Company Transition Policy;
- Production Legal Approval Gate;
- Contracting Party Intake Template.

## 5. Cross-document consistency rules

1. **Buyout vs Revenue Share:** an active eligible Buyout controls the post-Buyout commercial path for its exact Project ID; no hidden 10% stacking for the same post-Buyout Project Software Revenue.
2. **Buyout vs App Sale:** Buyout does not automatically transfer with project ownership. A buyer receives only the rights expressly transferred by the App Sale documents and any separately approved Buyout transfer mechanism.
3. **App Sale vs personal data:** source/IP transfer does not automatically transfer customer/end-user personal data.
4. **Electronic signature vs stamp duty:** valid electronic acceptance evidence and stamp-duty compliance are separate issues.
5. **Payment vs ownership:** payment success alone never proves App Sale/IP transfer completion.
6. **Operator transition:** approximately 1,000 registered users is a readiness trigger only; it never automatically novates agreements or changes the controller/operator.
7. **Tax wording:** no document may promise `tax free`, `stamp-duty exempt` or a specific stamp rate without a verified transaction-specific legal basis.
8. **Privacy wording:** no document may claim a DPO exemption merely from user count; actual monitoring and sensitive-data thresholds must be assessed.
9. **Production truth:** a document existing in GitHub, passing CI or being deployed does not make it legally approved or binding.

## 6. Versioning and activation

For every binding legal document the runtime must preserve:

- document key;
- exact version;
- cryptographic content hash;
- approval status;
- effective date;
- acceptance/signature level;
- accepted hash/version for every signer;
- supersession history.

Allowed lifecycle:

`DRAFT → LEGAL_APPROVED → APPROVED_NOT_ACTIVE → ACTIVE → SUPERSEDED/RETIRED`

Only an exact `ACTIVE` version may be offered for new binding self-service acceptance.

## 7. Current activation truth

This corpus is the latest internally harmonized legal drafting baseline. It is **not represented as Malaysian legal advice, legal approval or an ACTIVE customer contract** merely because the corpus is complete.

Before any document is promoted to `ACTIVE`, the Production Legal Approval Gate requires the exact document/version/hash to be approved by a qualified Malaysian legal reviewer and reconciled with the actual Product, payment, privacy, tax and runtime behavior.
