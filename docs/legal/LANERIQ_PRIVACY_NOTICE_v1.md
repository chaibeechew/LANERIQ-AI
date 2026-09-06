# LANERIQ AI Privacy Notice

**Version:** LANERIQ-PRIVACY-v1.1-DRAFT  
**Corpus:** LANERIQ-LEGAL-CORPUS-2026.09.05-r1  
**Status:** DRAFT — QUALIFIED MALAYSIAN PRIVACY/LEGAL REVIEW REQUIRED BEFORE PRODUCTION ACTIVATION  
**Last Harmonized:** 2026-09-05  
**Controller / Operator:** the individual identified in the private legal execution record, trading publicly as **LANERIQ AI**, until a lawful successor company becomes the controller/operator.

This Notice describes the intended handling of personal data in LANERIQ AI. It must be aligned with the actual Production data map, provider inventory and user-facing controls before activation.

## 1. Scope

This Notice applies to account creation, authentication, project creation, AI generation, support, payments, publishing assistance, security, marketplace transactions, project transfers and related LANERIQ AI services.

A project creator may separately act as controller of personal data collected through the app or website the creator builds. LANERIQ AI does not automatically become controller of every creator's end-user data merely because the project was generated using LANERIQ AI.

## 2. Data categories

Depending on the feature actually used, LANERIQ AI may process:

- account identifiers, name, email and authentication records;
- plan, purchase, invoice and payment-status information;
- project prompts, specifications, files and generated artifacts;
- limited usage, feature, device, browser, network and diagnostic information necessary for the service;
- security, fraud, malware and abuse-detection events;
- publishing metadata and user-supplied store declarations;
- marketplace listing, transaction, contract and acceptance records;
- customer-support communications;
- consent, Terms Version and electronic-signature evidence;
- limited technical metadata necessary for local/device-assisted processing; and
- other information a user intentionally provides.

Government ID numbers/images, signature images, banking credentials and similar high-risk identity evidence must not be stored in the public GitHub repository. If legally required for KYC, payment, e-signature or dispute handling, such information must use a separate private process with access controls and retention limits.

## 3. Data minimization and purpose limitation

LANERIQ should collect and retain the minimum personal data reasonably necessary for the stated purpose.

Personal data may be processed as reasonably necessary to:

1. provide, secure and administer the service;
2. authenticate users and protect accounts;
3. generate, build, test, store and publish user-requested projects;
4. operate subscriptions, purchases, Buyout, portability and marketplace workflows;
5. maintain transaction and legal evidence;
6. prevent fraud, malware, abuse, unauthorized access and policy violations;
7. respond to support and lawful requests;
8. improve reliability, quality, accessibility and safety using privacy-respecting analytics;
9. comply with legal, tax, accounting, security and regulatory obligations; and
10. establish, exercise or defend legal claims.

User content must not be silently repurposed for unrelated model training, advertising profiling or unrelated commercial exploitation. Any such use requires a separate lawful basis, clear disclosure and appropriate controls.

## 4. Legal basis / permitted processing

The final Production Notice must map each category and purpose to the applicable permitted ground under Malaysian law and, where relevant, other jurisdictions.

Where consent is relied upon, the consent must be sufficiently specific for the purpose and withdrawal must be respected where legally required.

Ordinary Terms acceptance must not be treated as blanket consent to optional tracking, advertising, unrelated model training, intensive device compute or unrelated background processing.

## 5. AI and service providers

LANERIQ AI may use third-party providers for AI inference, hosting, databases, storage, authentication, payments, analytics, security, communications, app-store-related services and other infrastructure.

Only data reasonably necessary for the requested function should be disclosed to a provider, subject to provider configuration, contract, security controls and the Provider Router architecture.

Provider availability, location and subprocessors may change. The Production privacy surface must maintain an accurate current provider/subprocessor disclosure appropriate to the service. No provider, certification, residency or security capability may be claimed solely because code supports it.

## 6. Device-first / own-device processing

Where LANERIQ offers local or device-assisted computation, the product must clearly disclose the relevant resource use, data access and controls. Local processing does not eliminate privacy obligations for data subsequently transmitted to LANERIQ or another provider.

Consent to ordinary Terms must not be treated as consent to undisclosed intensive resource use, unrelated background computation, cross-user/community compute or collection of unrelated device data.

Mobile Community Compute remains separate from ordinary Personal/Own-Device Compute and must not be inferred from this Notice or ordinary Terms.

## 7. Marketplace and project transfers

Selling source code or project/IP rights does not automatically authorize transfer of customer or end-user personal data.

Where an App Sale includes personal data, the parties must complete the LANERIQ App Sale Data Transfer Addendum and identify, as applicable:

- dataset and categories transferred;
- Seller/Buyer/controller/processor roles;
- permitted purpose;
- legal basis, notice and consent requirements;
- retention/deletion requirements;
- security controls;
- breach responsibilities;
- international-transfer controls; and
- post-completion access revocation.

LANERIQ may block a platform-assisted data export when required declarations are missing or a serious legal/security risk is detected.

## 8. Disclosure

LANERIQ AI may disclose personal data only as reasonably necessary to:

- contracted service providers/processors;
- payment providers/financial institutions for transaction processing;
- app stores or publishing providers when instructed by the user;
- professional advisers bound by appropriate confidentiality duties;
- authorities where lawfully required; or
- a lawful successor operator through a properly executed transition, subject to required notice/consent and data-protection obligations.

LANERIQ AI must not sell personal data to advertisers merely because a person uses the service.

## 9. International transfers

Where personal data is transferred or made accessible outside Malaysia, LANERIQ AI must apply the then-current Malaysian cross-border transfer requirements and any other applicable law, including appropriate safeguards where required.

The final Production Notice must be aligned to the actual provider/data-location map and current Personal Data Protection Commissioner cross-border guidance.

## 10. Retention

Personal data should be retained only as long as reasonably necessary for the stated purpose, contractual obligations, security, fraud prevention, backups, dispute handling, legal claims or legal/regulatory retention requirements.

The Production implementation should define category-specific retention periods rather than rely on indefinite retention.

Account deletion does not necessarily require immediate deletion of records LANERIQ must lawfully preserve for payment, tax, fraud, security, signed contracts, transaction evidence or legal claims.

## 11. Security

LANERIQ AI should apply reasonable administrative, technical and organizational measures proportionate to risk, including access controls, least privilege, credential isolation, encryption where appropriate, logging, malware/security checks, secrets management, backup controls and incident response.

No security certification or control may be represented as Production-verified unless actual evidence exists.

## 12. Personal-data breach notification — current Malaysian baseline

As of the 2026-09-05 regulatory review, the Malaysian Personal Data Protection Commissioner's current Data Breach Notification guidance states that where a personal data breach meets the notification criteria, notification to the Commissioner must be made as soon as practicable and no later than **72 hours from the occurrence of the breach**.

The guidance also requires a preliminary investigation after a security incident is detected/reported to determine whether a personal data breach actually occurred. Official examples show that the practical clock anchor depends on the facts — including loss awareness, realization of an unauthorized disclosure, or confirmation of a network compromise.

Accordingly LANERIQ's incident record must preserve, where known:

- `occurred_at`;
- `detected_at`;
- `confirmed_breach_at`;
- the selected notification clock anchor;
- the legal/assessment basis for that anchor; and
- actual notification timestamps/references.

LANERIQ must not hard-code `confirmed_breach_at + 72 hours` as a universal legal rule.

## 13. Data Protection Officer — current Malaysian baseline

As of the 2026-09-05 regulatory review, current Commissioner guidance states that a data controller or data processor must appoint one or more DPOs if processing involves **any** of the following:

1. personal data exceeding **20,000 data subjects**;
2. sensitive personal data, including financial information, exceeding **10,000 data subjects**; or
3. activities requiring **regular and systematic monitoring of personal data**, including online user-behaviour tracking.

Therefore LANERIQ must not infer `no DPO required` merely because registered users are below 20,000.

The approximately 1,000-user company-transition trigger is unrelated to DPO applicability.

## 14. Data-controller registration

LANERIQ must separately assess any data-controller registration obligation under the PDPA, the Commissioner's 2026 registration circular, applicable registration classes/orders and the actual business/processing role.

Data-controller registration and DPO appointment/registration are separate compliance questions and must not be conflated.

## 15. User rights

Subject to applicable law, users may have rights to request access, correction, withdrawal of consent where relevant, information about processing, complaint mechanisms and other statutory rights.

The final Production page must describe the actual rights/request channels available under then-current law and must not promise rights the platform cannot lawfully or technically fulfil.

## 16. Children and age-sensitive use

LANERIQ AI should not knowingly process children's personal data in a manner inconsistent with applicable law. Features directed to minors or likely to process children's data require additional product/legal review before activation.

## 17. Automated systems

LANERIQ AI uses automated and AI systems to generate content, route providers, identify security risk, test software and assist workflows. Where automated processing produces material consequences, the product should provide meaningful review/correction/appeal mechanisms where legally required or appropriate to risk.

## 18. Cookies and similar technologies

The Production implementation must maintain an accurate cookie/storage inventory. Non-essential analytics, advertising or tracking technologies must not be described as strictly necessary and should use appropriate consent controls where legally required.

Regular/systematic online user-behaviour monitoring may independently affect DPO applicability and therefore must not be introduced without a privacy/DPO assessment.

## 19. Operator transition

Until a lawful successor-company transition is effective, the current individual operator remains the controller/operator identified in the private legal record.

A successor company may assume the relevant role only after incorporation, legal review, appropriate transfer/novation/assignment arrangements, privacy due diligence and legally sufficient notice or consent where required.

## 20. Contact and complaints

The final Production Notice must publish a business-appropriate privacy contact channel without exposing private residential information or unnecessary identity documents.

Users must be informed of any applicable right to complain to the Malaysian Personal Data Protection Commissioner or another competent authority.

## 21. Legal review gate

Before activation, qualified Malaysian counsel/privacy professionals should verify this Notice against the actual Production data flows, Personal Data Protection Act 2010 and 2024 amendments, commencement orders, current 2025/2026 circulars/guidelines, breach-notification rules, DPO/registration requirements, cross-border transfer rules, sector obligations, processor contracts and actual third-party providers.
