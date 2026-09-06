# LANERIQ AI Cookie & Tracking Notice

**Version:** LANERIQ-COOKIE-TRACKING-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — QUALIFIED MALAYSIAN LEGAL/PRIVACY REVIEW REQUIRED BEFORE PRODUCTION ENFORCEMENT  
**Last Harmonized:** 2026-09-05

This Notice explains the intended use of cookies, local storage, SDK identifiers and similar technologies on LANERIQ AI websites, web apps and supported applications. It must match the technologies actually deployed in Production.

## 1. Core rule

LANERIQ AI should use the minimum tracking needed for security, authentication, reliability, user-requested features and lawful product measurement. Advertising or non-essential tracking must not be silently treated as necessary.

Ordinary Platform Terms acceptance is not blanket consent to optional tracking.

## 2. Categories

### Strictly necessary
May be used where genuinely required for login, session continuity, CSRF/security controls, fraud prevention, load balancing, user-requested preferences and transaction integrity.

### Functional
May remember optional preferences such as language, layout or recently selected workspace where appropriate.

### Analytics
May measure product reliability, crashes, performance, aggregate feature adoption or conversion only within the approved privacy design. Analytics should minimize raw identifiers and free-form user content.

Analytics architecture must not be described as anonymous or aggregate unless the actual Production implementation supports that claim.

### Advertising / cross-context tracking
Must remain disabled unless expressly approved through a separate legal, privacy and product review. Account creation, Terms acceptance or use of a free service must not be treated as consent to targeted advertising tracking.

## 3. Consent and controls

Where consent is legally required, the product should provide a clear choice before activating the relevant non-essential technology.

Refusal of non-essential tracking must not block core service functionality unless the technology is genuinely necessary for the requested feature.

Consent evidence should preserve the exact notice/version, categories accepted or refused, timestamp and account/session reference appropriate to the purpose.

Users should be able to revisit optional tracking preferences without deleting their account.

## 4. DPO / monitoring assessment

Under the Malaysian PDPA DPO guidance reviewed on 2026-09-05, regular and systematic monitoring of personal data — including online user-behaviour tracking — is an independent DPO trigger.

Therefore introduction or material expansion of behavioural analytics, profiling, cross-session tracking or advertising identifiers requires a DPO/privacy assessment even where LANERIQ has fewer than 20,000 users.

The product must not infer `no DPO required` from user count alone.

## 5. Local-first and device storage

LANERIQ AI may use device-local storage for local-first functionality, drafts, project state, cached assets and user-requested preferences. Device-local storage is not automatically advertising tracking.

The product should distinguish functional local storage from analytics, profiling, advertising or cross-context identifiers.

Device Compute consent is separate from tracking consent. Optional resource use must not be disguised as an analytics permission.

## 6. Third parties

Third-party providers may set or read identifiers only within the approved scope for the relevant service. Provider SDKs must not be assumed to be privacy-neutral.

Before activation, LANERIQ should document the actual provider, purpose, data categories, retention, access, transfer and opt-out/consent behaviour.

## 7. Sensitive content

Raw prompts, source code, project secrets, private keys, authentication tokens, payment data, government identifiers and sensitive personal data should not be intentionally placed into analytics or advertising payloads unless specifically required, legally justified and separately protected.

## 8. Children and age-sensitive contexts

Tracking for children, education/minor contexts or other specially regulated audiences requires separate legal review and age-appropriate safeguards before activation.

## 9. Change management

Material expansion of tracking purposes, introduction of advertising/cross-site tracking or a move from aggregate measurement to persistent user profiling requires:

- a new notice/version where appropriate;
- privacy/DPO reassessment;
- reassessment of consent requirements; and
- Production evidence that the described technology actually matches runtime behaviour.

## 10. Relationship to Privacy Notice

This Notice supplements the LANERIQ AI Privacy Notice. If tracking data constitutes personal data, the Privacy Notice and applicable data-protection requirements also apply.

## 11. Legal review gate

Before Production activation, qualified Malaysian counsel/privacy professionals should confirm the final consent model, categories, retention, cross-border transfers, provider SDK behaviour, DPO implications and interaction with the Personal Data Protection Act 2010 as amended and current Commissioner guidance.
