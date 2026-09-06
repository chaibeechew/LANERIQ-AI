# LANERIQ AI Electronic Signature & Acceptance Evidence Standard

**Version:** LANERIQ-ESIGN-EVIDENCE-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — LEGAL REVIEW REQUIRED BEFORE BINDING PRODUCTION USE  
**Last Harmonized:** 2026-09-05

## 1. Principle

LANERIQ AI should not require users or the current individual Operator to upload photographed handwritten signatures into the public product repository.

For commercial agreements, the platform should use an electronic execution workflow designed to identify the signer, record affirmative approval, bind approval to the exact document version/hash and preserve tamper-evident evidence.

Electronic execution evidence and Malaysian stamp-duty compliance are separate matters. A signed electronic document, payment receipt, cryptographic hash or LANERIQ certificate must not be represented as proof that an instrument is duly stamped.

## 2. Acceptance levels

### Level A — notice / acknowledgement

Suitable for Privacy Notice delivery and other disclosures where the legal requirement is primarily notice rather than contractual consent.

Evidence target:

- exact notice/document version;
- served/presented timestamp;
- account/session reference where available; and
- separate consent record where consent is actually required.

### Level B — ordinary platform clickwrap

Suitable for Platform Terms, Acceptable Use rules and ordinary platform contractual terms.

Required evidence:

- authenticated account ID;
- exact document version/hash;
- affirmative unticked-by-default acceptance action;
- timestamp; and
- durable acceptance ledger.

### Level C — material commercial acceptance

Suitable for Buyout, Project Portability / Revenue Share, paid commercial addenda and similar material terms.

Required evidence:

- all Level B evidence;
- typed/verified legal or display name in the private execution record as appropriate;
- recent re-authentication, MFA or comparable step-up control;
- immutable document hash;
- transaction/project/order ID;
- price, revenue-share or material-obligation snapshot; and
- downloadable execution record/certificate where appropriate.

The Buyout record should additionally bind the exact Project ID, Buyout tier, price/currency, License ID and the then-current Buyout terms version/hash.

### Level D — bilateral App Sale / IP assignment / ownership transfer

Required for App Sale & IP Assignment and comparable ownership transfers.

Required evidence:

- all Level C evidence for Seller and Buyer separately;
- Seller role explicitly labelled **Assignor / Seller**;
- Buyer role explicitly labelled **Assignee / Buyer**;
- both parties shown the final Asset Schedule before signing;
- explicit statement that the signer intends to be legally bound;
- separate affirmative confirmation for IP assignment;
- private signer identity/authority record;
- signature timestamp for each party;
- MFA/step-up verification appropriate to risk;
- exact Agreement Version and cryptographic hash;
- immutable Project ID and Transaction ID;
- audit record of document generation, signing and completion; and
- final Handover & Acceptance Certificate.

A scanned or photographed signature image is optional only if later required by a legally reviewed external process. It is not the default LANERIQ AI signing method.

## 3. Written-form requirement for copyright/IP assignment

The App Sale/IP Assignment execution record must preserve a final written instrument and exact signed copy. Under section 27(3) of Malaysia's Copyright Act 1987, an assignment of copyright or licence of a controlled act has no effect unless it is in writing.

LANERIQ therefore must not treat an informal chat message, payment event, listing click or incomplete workflow as the written IP assignment instrument.

## 4. Stamp-duty separation

The e-signature system must not:

- infer that an instrument is stamp-duty exempt;
- calculate or guess a stamp-duty classification or rate;
- mark an agreement as `duly stamped` merely because it was electronically executed;
- automatically file, submit or pay Malaysian stamp duty; or
- store a fake or platform-generated stamp certificate.

Where stamp-duty review is relevant, the legal record may store a separate manual-review status and genuine official submission/certificate reference supplied by the responsible person.

For Buyout, the commercial allocation in the Buyout License places the relevant stamping and filing cost on the Customer as between the parties, except where mandatory law allocates liability differently.

## 5. Privacy and security

Never publish or commit to a public repository:

- signature specimens;
- government ID numbers/images;
- private legal addresses;
- personal notice emails where not intended for publication;
- bank details;
- raw OTP codes;
- authentication secrets;
- card data; or
- raw/persistent device fingerprint data.

Public code may contain only field definitions, placeholders and evidence rules.

## 6. Document integrity

At signing time, LANERIQ AI should freeze the exact execution copy and compute a stable cryptographic hash. Any post-signature alteration to material terms must create a new Agreement Version or amendment and require new acceptance where legally necessary.

The system must never silently replace an accepted/signed hash with the latest GitHub text.

## 7. Consent UX

The execution UI must not use pre-ticked boxes, hidden consent, deceptive button labels or silent acceptance.

For Level C and D documents, the signer should see at minimum:

- document title and version;
- counterparty identity;
- Project ID / Transaction ID;
- material price, revenue-share or ownership-transfer terms;
- asset-transfer summary where relevant;
- clear access to the full document;
- legal-name/authority confirmation appropriate to the transaction;
- explicit signature/acceptance control; and
- confirmation that electronic signing creates an intended legal record.

Optional tracking, device-compute consent and other legally separate consents must not be bundled into commercial agreement acceptance merely for convenience.

## 8. Operator signature

The current individual LANERIQ AI Operator's legal name and execution signature must be held in private legal/signing infrastructure, not hard-coded into the public repository.

Where a LANERIQ AI countersignature is legally or commercially required, the signing system may apply it only after all applicable approval gates are satisfied. Creator-to-buyer App Sales do not automatically require LANERIQ to become a transaction principal or countersignatory merely because the platform provides the workflow.

## 9. Future company transition

After the successor company becomes the lawful contracting operator, new agreements should display the successor company's verified legal identity in the execution layer and public legal notice as appropriate.

Existing agreements must not have their historical signer or contracting party silently rewritten. Any novation/accession/assignment must create its own evidence record.

## 10. Legal review gate

Before binding Production use, qualified Malaysian counsel should confirm the workflow against the Electronic Commerce Act 2006, Contracts Act 1950, Copyright Act 1987, Consumer Protection Act 1999, Stamp Act 1949 and transaction-specific requirements, including whether any category requires a stronger signature form, witness, stamping, adjudication or external signing provider.
