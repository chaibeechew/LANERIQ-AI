import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const must = (condition, message) => {
  if (!condition) throw new Error(`LEGAL CORPUS CONTRACT FAILED: ${message}`);
};
const contains = (text, needle, message) => must(text.includes(needle), message || `missing: ${needle}`);
const containsAny = (text, needles, message) => must(needles.some((n) => text.includes(n)), message || `missing one of: ${needles.join(', ')}`);
const notContains = (text, needle, message) => must(!text.includes(needle), message || `forbidden: ${needle}`);

const manifest = read('docs/legal/LANERIQ_LEGAL_CORPUS_MANIFEST_v1.md');
const tos = read('docs/legal/LANERIQ_PLATFORM_TERMS_OF_SERVICE_v1.md');
const buyout = read('docs/legal/LANERIQ_BUYOUT_LICENSE_v1.md');
const portability = read('docs/legal/LANERIQ_PROJECT_PORTABILITY_REVENUE_SHARE_AGREEMENT_v1.md');
const marketplace = read('docs/legal/LANERIQ_APP_MARKETPLACE_TERMS_v1.md');
const sale = read('docs/legal/LANERIQ_APP_SALE_IP_ASSIGNMENT_AGREEMENT_v1.md');
const assetSchedule = read('docs/legal/LANERIQ_APP_SALE_ASSET_SCHEDULE_v1.md');
const dataAddendum = read('docs/legal/LANERIQ_APP_SALE_DATA_TRANSFER_ADDENDUM_v1.md');
const handover = read('docs/legal/LANERIQ_APP_SALE_HANDOVER_ACCEPTANCE_CERTIFICATE_v1.md');
const refund = read('docs/legal/LANERIQ_REFUND_CANCELLATION_CHARGEBACK_POLICY_v1.md');
const aup = read('docs/legal/LANERIQ_ACCEPTABLE_USE_POLICY_v1.md');
const operatorTransition = read('docs/legal/LANERIQ_OPERATOR_SUCCESSOR_COMPANY_TRANSITION_POLICY_v1.md');
const contractingIntake = read('docs/legal/LANERIQ_CONTRACTING_PARTY_INTAKE_TEMPLATE.md');
const privacy = read('docs/legal/LANERIQ_PRIVACY_NOTICE_v1.md');
const esign = read('docs/legal/LANERIQ_ELECTRONIC_SIGNATURE_EVIDENCE_STANDARD_v1.md');
const matrix = read('docs/legal/LANERIQ_LEGAL_ACCEPTANCE_MATRIX_v1.md');
const tax = read('docs/legal/LANERIQ_TAX_STAMP_DUTY_OPERATIONS_POLICY_v1.md');
const legalGate = read('docs/legal/LANERIQ_PRODUCTION_LEGAL_APPROVAL_GATE_v1.md');
const cookie = read('docs/legal/LANERIQ_COOKIE_TRACKING_NOTICE_v1.md');
const dpa = read('docs/legal/LANERIQ_ENTERPRISE_DATA_PROCESSING_ADDENDUM_v1.md');
const kyc = read('docs/legal/LANERIQ_MARKETPLACE_SELLER_VERIFICATION_KYC_RULES_v1.md');
const takedown = read('docs/legal/LANERIQ_IP_NOTICE_AND_TAKEDOWN_PROCEDURE_v1.md');

// Corpus identity and activation truth.
contains(manifest, 'LANERIQ-LEGAL-CORPUS-2026.09.05-r1');
contains(manifest, 'NOT ACTIVE');
contains(manifest, 'mandatory applicable law');
contains(legalGate, 'Only an exact `ACTIVE` version');
contains(legalGate, 'GitHub main legal version/hash');

// Buyout economics and anti-double-charge rule.
for (const price of ['US$49', 'US$199', 'US$499']) contains(buyout, price, `Buyout price missing: ${price}`);
contains(buyout, '**0%**');
contains(buyout, 'must not be silently combined');
contains(portability, 'An active eligible Buyout License must not be silently combined');
contains(tos, 'must not silently stack the 10% portability share');

// Buyout stamp-duty allocation + mandatory law override.
contains(buyout, 'Buyout Customer bears and is responsible');
contains(buyout, 'mandatory law allocates liability');
contains(buyout, 'MANUAL REVIEW ONLY');
contains(tax, 'MANUAL REVIEW ONLY');
contains(tax, 'Third Schedule');
contains(tax, '30 days');
contains(tax, 'RM100 or 20%');
contains(tax, 'below RM3,000,000');
contains(tos, 'does not automatically classify, calculate, adjudicate, submit, file, stamp or pay');

// No automatic stamp-duty or false stamped status.
for (const text of [buyout, tos, esign, matrix, tax, legalGate]) {
  notContains(text, 'automatically pay stamp duty on the Customer’s behalf');
  notContains(text, 'electronic signing satisfies stamp duty');
}
contains(esign, 'must not be represented as proof that an instrument is duly stamped');
contains(matrix, 'Acceptance/signature strength does not determine whether an instrument is chargeable');

// Buyout does not silently transfer to later buyer.
contains(buyout, 'does **not** automatically transfer to a later buyer');
contains(tos, 'does not automatically transfer to a later App buyer');

// Marketplace / App Sale truth boundaries.
contains(marketplace, 'LANERIQ AI is not an escrow provider');
contains(marketplace, 'Completion does not occur merely because');
contains(sale, 'No ownership transfer occurs merely because');
contains(sale, 'No customer/user database is deemed transferred');
contains(sale, 'assignment');
contains(assetSchedule, 'personal data unless separately approved under the Data Transfer Addendum');
contains(assetSchedule, 'only assets marked included are represented as being transferred');
contains(dataAddendum, 'Sale of source code does not automatically include personal data');
contains(dataAddendum, 'Seller and Buyer must electronically sign it');
contains(handover, 'generated only after the required App Sale completion gates pass');
contains(handover, 'is not an independent legal opinion on title, valuation, tax or regulatory compliance');

// Refund / chargeback cannot silently rewrite ownership.
contains(refund, 'Nothing in this Policy removes refund, cancellation, remedy or consumer rights');
contains(refund, 'Refund does not automatically reverse IP');
contains(refund, 'money reversal and IP ownership reversal are legally distinct');
contains(refund, 'No project-specific licence should be marked ACTIVE before the required payment and acceptance evidence is complete');

// AUP continues to preserve Marketplace, privacy and evidence integrity.
contains(aup, 'A project sale does not authorize automatic transfer of the project\'s user database');
contains(aup, 'must not knowingly');
contains(aup, 'interfere with logs, evidence, audit records or security controls');

// Copyright written-form contract.
contains(esign, 'section 27(3)');
contains(esign, 'has no effect unless it is in writing');

// PDPA DPO + DBN current baseline.
contains(privacy, '20,000 data subjects');
contains(privacy, '10,000 data subjects');
contains(privacy, 'regular and systematic monitoring');
contains(privacy, '72 hours from the occurrence');
contains(privacy, 'must not hard-code `confirmed_breach_at + 72 hours`');
contains(cookie, 'regular and systematic monitoring');
contains(dpa, '72 hours from occurrence');
contains(dpa, '20,000 data subjects');

// Privacy and consent separation.
contains(privacy, 'must not be treated as blanket consent');
contains(cookie, 'Ordinary Platform Terms acceptance is not blanket consent');
containsAny(matrix, ['Device Compute Consent / Resource Use Notice', 'Device Compute Consent'], 'Device Compute must be separate consent');

// Seller verification must not overclaim KYC/AML or regulated role.
contains(kyc, 'This is not KYC/AML clearance');
contains(kyc, 'must not be described as `AML cleared`');
contains(kyc, 'does not by itself make LANERIQ an escrow provider');

// IP procedure remains evidence-preserving and does not fake safe-harbour readiness.
contains(takedown, 'safe-harbour claim remains **NOT READY**');
contains(takedown, 'A hold preserves evidence/risk controls and is not a final adjudication of ownership');

// Operator transition and private contracting identity stay historically truthful.
contains(operatorTransition, '1,000-user threshold is an internal operational trigger only');
contains(operatorTransition, 'does not automatically create, substitute or novate a legal contracting party');
contains(operatorTransition, 'duplicate or restart an existing revenue-share obligation');
contains(operatorTransition, 'invalidate an existing valid Buyout');
contains(operatorTransition, 'preserve historical agreements exactly as originally executed');
contains(contractingIntake, 'DO NOT COMMIT COMPLETED PERSONAL DATA TO THE PUBLIC REPOSITORY');
contains(contractingIntake, 'does not require a Creator to pay the same Revenue Share twice');
contains(contractingIntake, 'No completed intake record by itself activates Production enforcement');

console.log('LANERIQ legal corpus harmonization contract: PASS');
