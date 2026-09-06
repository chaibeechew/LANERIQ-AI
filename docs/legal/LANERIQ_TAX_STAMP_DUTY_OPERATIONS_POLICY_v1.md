# LANERIQ AI Tax & Stamp Duty Operations Policy

**Version:** LANERIQ-TAX-STAMP-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — MALAYSIAN TAX/LEGAL REVIEW REQUIRED BEFORE COMMERCIAL ENFORCEMENT  
**Last Harmonized:** 2026-09-05

This policy defines how LANERIQ AI handles tax, e-Invoice and Malaysian stamp-duty questions for subscriptions, Buyout Licenses, Revenue Share agreements, App Sale/IP transfers and related transactions.

## 1. No automatic tax conclusion

LANERIQ AI must not assume that every electronic agreement is exempt from stamp duty, that every software transaction has the same tax treatment, or that the platform can determine a party's final tax liability without the relevant transaction facts.

The applicable treatment may depend on the legal instrument, consideration, parties, jurisdiction, business/taxpayer status, execution facts, payment flow and then-current law.

## 2. Party responsibility

Unless a legally approved transaction term allocates a specific contractual cost differently:

- each party remains responsible for taxes legally attributable to that party;
- mandatory statutory liability cannot be displaced by internal product wording;
- transaction records should distinguish purchase price, LANERIQ fees, taxes/duties, processing charges, refunds and chargebacks;
- LANERIQ may collect/withhold/remit amounts only where required by applicable law or a separately approved payment/tax flow; and
- no user-facing statement may promise `tax free`, `stamp-duty exempt` or a specific duty rate without a verified legal basis.

## 3. Malaysian stamp duty — current operational baseline

As of the 2026-09-05 review, current HASiL guidance confirms:

- section 33 and the Third Schedule to the Stamp Act 1949 determine the person liable to pay duty for a particular instrument;
- as a general rule, a chargeable instrument executed in Malaysia should be stamped within 30 days after execution;
- an instrument executed outside Malaysia generally has a 30-day period after first receipt in Malaysia;
- current late-stamping guidance provides RM50 or 10% of deficient duty, whichever is higher, for the first late tier and RM100 or 20%, whichever is higher, for later cases; and
- instrument classification depends on legal substance rather than the document title alone.

These facts are a compliance baseline, not an automatic classification engine.

## 4. Manual-only stamp-duty control

LANERIQ AI must not automatically calculate, assess, classify, adjudicate, submit, file, stamp, pay or authorize payment of Malaysian stamp duty.

Production handling is **MANUAL REVIEW ONLY** unless the owner later gives a separate explicit instruction and a separately reviewed legal/tax implementation is approved.

The platform may:

- record that stamp-duty review may be required;
- preserve the relevant agreement version/hash, execution date and transaction reference;
- store a manual review status and later genuine official evidence/reference; and
- direct an authorized operator/user to the official process.

The platform must not:

- call a government filing/payment workflow automatically;
- debit a buyer, seller, Customer or LANERIQ payment method for stamp duty automatically;
- guess a duty rate/instrument classification;
- treat a signed agreement or payment receipt as duly stamped; or
- change `manual_review_only` through ordinary runtime logic.

Any future automated stamp-duty capability requires a new explicit owner decision, qualified Malaysian legal/tax review, a separate Production change set and its own approval/evidence gate.

## 5. Buyout Customer allocation

For a LANERIQ AI Project Buyout License, the intended commercial allocation is that the **Buyout Customer bears and is responsible for any stamp duty, adjudication, filing, payment and related governmental charge attributable to that Buyout instrument**, except to the extent applicable mandatory law allocates liability to another person.

Accordingly:

- LANERIQ does not automatically assess, file, stamp or pay the Buyout Customer's stamp duty;
- LANERIQ does not automatically deduct duty from the Buyout fee or charge a guessed amount;
- the Customer is responsible for completing any legally required process attributed to the Customer under the final approved terms/law;
- LANERIQ may preserve the Buyout License, License ID, Project ID, exact version/hash, execution date and later official evidence supplied by the responsible person; and
- if mandatory law assigns liability differently, that mandatory legal allocation prevails to the extent required.

This does not state that every Buyout License is necessarily chargeable, exempt or subject to a particular rate.

## 6. Other instrument classifications

Before the product labels an instrument for stamp-duty purposes, transaction-specific legal/tax review should determine the appropriate classification where material, including for:

- Project Portability / Revenue Share Agreement;
- Buyout License;
- App Sale & IP Assignment Agreement;
- company novation/accession instrument;
- Enterprise order forms/DPAs where relevant; and
- any security, financing, escrow or payment instrument introduced later.

Where classification is uncertain, show **STAMP-DUTY REVIEW REQUIRED** rather than guessing.

## 7. Stamping evidence

If stamping/adjudication occurs, the private transaction record should store only the minimum necessary evidence such as:

- instrument/transaction ID;
- execution date;
- official stamp submission/reference number;
- assessment/payment status;
- official certificate/confirmation reference; and
- reviewer/processor status.

Tax IDs, identity documents and payment information must remain private and must not be published in the public repository/certificate.

## 8. Marketplace/App Sale

For an App Sale, the transaction record should separately identify:

1. Seller sale proceeds;
2. LANERIQ platform/transaction fees, if any;
3. third-party processor fees;
4. taxes/duties collected or withheld only where actually applicable and approved;
5. refunds/chargebacks; and
6. net payout.

LANERIQ does not become the statutory stamp-duty payer merely because the transaction uses the platform.

## 9. e-Invoice — current 2026 baseline

HASiL's public e-Invoice implementation timeline was updated on 30 August 2026. It currently states that taxpayers with annual turnover/revenue **below RM3,000,000 are exempt from e-Invoice implementation**, subject to the then-current detailed conditions and taxpayer facts.

Therefore:

- LANERIQ must not buy/activate an e-Invoice SaaS merely on the assumption that every current-stage operator is required to use it;
- actual annual turnover/revenue, taxpayer type and detailed exemption conditions must be assessed;
- structured transaction/receipt records should still be preserved for ordinary accounting/tax purposes and future integration; and
- e-Invoice exemption does not mean income or other taxes are exempt.

## 10. Cross-border transactions

Cross-border sellers/buyers may create additional withholding, indirect-tax, permanent-establishment, marketplace-reporting or foreign stamp/registration obligations. LANERIQ must not promise that Malaysian treatment resolves every foreign obligation.

High-value/cross-border transactions may be routed to professional review before completion.

## 11. Zero-new-cost current-stage implementation

At the current stage, this policy requires no paid tax software. LANERIQ can remain 0-new-cost by:

- storing structured transaction fields;
- preserving signed versions/hashes;
- flagging tax/stamp review instead of guessing liabilities;
- maintaining official filing references only when a real filing occurs; and
- delaying automated tax engines until legally/commercially justified.

Actual government duties, taxes, statutory filing costs and professional fees when legally required cannot truthfully be eliminated by product design.

## 12. Company transition

When LANERIQ transitions from the current individual operator to a successor company, the tax/stamp treatment of any transition instrument and future invoicing/payment flows must be reviewed before the new entity becomes the contracting operator.

## 13. Legal review gate

Before commercial activation of a specific binding instrument, qualified Malaysian tax/legal review should confirm the applicable classification/treatment, person statutorily liable, any contractual cost allocation, filing timeline, invoice/receipt obligations, payment flow and record retention.

This legal-review requirement does not authorize automatic stamp-duty calculation, filing or payment. Manual-only handling remains the default until a later explicit owner decision changes it through a separately approved Production change.
