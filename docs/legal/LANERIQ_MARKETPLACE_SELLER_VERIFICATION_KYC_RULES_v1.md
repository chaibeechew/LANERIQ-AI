# LANERIQ AI Marketplace Seller Verification & KYC Rules

**Version:** LANERIQ-SELLER-VERIFICATION-KYC-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — LEGAL/COMPLIANCE REVIEW REQUIRED BEFORE MARKETPLACE ACTIVATION  
**Last Harmonized:** 2026-09-05

These rules define a risk-based identity and transaction-verification framework for creators selling Apps, source code or related project assets through LANERIQ AI.

## 1. Core principle

LANERIQ should verify enough information to reduce fraud, unauthorized sales, account takeover, sanctions/payment abuse and identity disputes without collecting unnecessary identity data or forcing every user into expensive third-party KYC.

Verification strength should increase with transaction risk and the actual legal/payment role LANERIQ performs.

## 2. Current zero-new-cost stage

Until a legally reviewed rule or transaction risk requires otherwise, LANERIQ may use existing controls including:

- authenticated LANERIQ account;
- verified contact method where available;
- MFA/reauthentication for high-risk execution;
- project ownership/history evidence;
- repository/project creation evidence;
- payment-account consistency signals supplied by an existing payment provider;
- bounded fraud, malware and account-takeover risk signals;
- manual review of necessary supporting evidence; and
- tamper-evident acceptance/audit records.

No paid KYC vendor is required merely because a person creates an account or lists a low-risk project.

## 3. Verification tiers

### Tier 0 — Account verification
Suitable for ordinary platform use and non-transactional creation. This is not KYC/AML clearance and is insufficient by itself for ownership-transfer completion.

### Tier 1 — Standard Seller verification
May require authenticated account, verified contact method, MFA for sale execution, project ownership declaration, transaction history and payout-name consistency where available.

A Tier 1 status must not be described as `AML cleared` or equivalent regulated clearance.

### Tier 2 — Enhanced transaction verification
May be required for higher-value sales, unusual payout patterns, new-account/high-value combinations, cross-border risk, IP disputes, repeated chargebacks or other elevated-risk factors. Additional private evidence may be requested only where proportionate and necessary.

### Tier 3 — Regulated/specialist verification
If applicable law, a regulated payment/escrow/custody structure, sanctions/AML obligations or transaction scale requires specialist verification, LANERIQ may require an approved third-party KYC/AML provider before that transaction proceeds.

Tier 3 must not be represented as active until a real provider, legal basis, retention model and Product approval exist.

## 4. Seller declarations

Before completing an App Sale, the Seller must affirm that:

1. the Seller is the owner or authorized transferor of the listed assets;
2. the Seller is not knowingly selling stolen, misappropriated or unauthorized code/content;
3. material third-party/open-source restrictions are disclosed;
4. material revenue/user/traffic claims are not intentionally false or misleading;
5. personal data will not be transferred unlawfully; and
6. the Seller will cooperate with reasonable fraud/IP verification requests.

These declarations do not replace actual verification where the transaction risk requires more evidence.

## 5. Private identity evidence

Government-issued ID, passport details, proof of address, tax identifiers and bank/payment evidence must be collected only when justified by the relevant tier, provider requirement or applicable law.

Such evidence must be stored in a private compliance process with restricted access and defined retention. It must never be committed to the public GitHub repository or embedded in public certificates.

Do not collect a handwritten signature image merely as a substitute for proper electronic execution evidence.

## 6. Holds and rejection

LANERIQ may place a proportionate hold or reject a transaction where evidence reasonably indicates:

- account takeover;
- false identity/impersonation;
- unauthorized project sale;
- unresolved material IP ownership dispute;
- malware/malicious backdoors;
- suspicious payment reversal/chargeback patterns;
- sanctions or regulated-payment concerns identified through an approved process;
- forged evidence; or
- refusal to provide verification reasonably necessary for the transaction risk.

A hold is a risk-control action, not a criminal/civil finding.

## 7. Buyer protection and truth labels

A Seller verification badge/status must describe only what was actually checked.

LANERIQ must not label a Seller `fully verified`, `KYC approved`, `AML cleared`, `sanctions cleared` or equivalent unless the underlying process truly supports that statement.

Buyer due diligence remains required, and verification is not a guarantee of future App performance, revenue or ownership beyond the evidence actually reviewed.

## 8. Marketplace/payment role boundary

LANERIQ's Seller verification workflow does not by itself make LANERIQ an escrow provider, money-services business, fiduciary, broker or regulated custodian.

If LANERIQ later changes its payment role, holds funds, controls custody or activates a regulated escrow/payment arrangement, the legal/KYC/AML/licensing analysis must be redone before that feature is represented as active.

## 9. Tax and stamp-duty boundary

Seller verification does not determine who is statutorily liable for tax or stamp duty.

Stamp-duty classification/payment remains **MANUAL REVIEW ONLY** under the Tax & Stamp Duty Operations Policy. LANERIQ does not auto-file or auto-pay duty merely because the Seller or Buyer is verified.

## 10. Retention

Verification records should be retained only for a documented period justified by transaction evidence, fraud prevention, payment, tax, legal claims or applicable-law requirements.

Deletion rules must account for legal holds and genuine dispute/chargeback windows without retaining unnecessary identity evidence indefinitely.

## 11. Company transition

Until the LANERIQ operator lawfully transitions to a successor company, operator-side compliance records must continue to identify the current individual operator privately where legally necessary.

Approximately 1,000 registered users triggers company-transition readiness only; it does not automatically substitute the contracting party or create a new KYC status.

## 12. Legal review gate

Before Marketplace Production activation, qualified Malaysian counsel/compliance advisers should confirm whether the actual planned payment, escrow, custody, marketplace or cross-border activity creates mandatory identity, AML/CFT, sanctions, tax-reporting or licensing obligations and which transactions require specialist verification.
