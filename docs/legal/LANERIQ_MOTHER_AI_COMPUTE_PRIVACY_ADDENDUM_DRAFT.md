# LANERIQ AI — Mother AI Compute Privacy Addendum

**Version:** LANERIQ-MOTHER-AI-COMPUTE-PRIVACY-2026-09-05-DRAFT  
**Status:** DRAFT — QUALIFIED MALAYSIAN PRIVACY/LEGAL REVIEW REQUIRED BEFORE PRODUCTION COMMUNITY COMPUTE  

This addendum describes the intended privacy and consent boundaries for Mother AI Device Intelligence. It supplements, and does not replace, the main LANERIQ AI Privacy Notice.

## 1. Mother AI identity

Mother AI is LANERIQ AI's core intelligence identity. It is not a separate data controller, provider or hidden third-party service.

## 2. Personal Compute

Personal Compute means Mother AI may use a small adaptive amount of the user's own device CPU, GPU or NPU for LANERIQ functionality requested by that user.

Personal Compute:

- requires a prominent in-product explanation before first activation;
- requires an affirmative user choice;
- remains optional;
- can be disabled later;
- does not grant LANERIQ permission to read unrelated private files, passwords, contacts, messages, browsing history or other data;
- does not imply consent to advertising tracking, unrelated profiling or unrelated commercial use;
- is subject to Resource Guardian limits including thermal, battery, foreground and platform constraints; and
- may fall to zero resource use when the device or operating system requires it.

## 3. Community Compute

Community Compute is a separate optional purpose from Personal Compute.

It must never be enabled merely because the user agreed to Personal Compute or accepted general Terms.

Before any Production Community Compute execution is activated, LANERIQ must complete a separate technical, privacy and legal release gate including:

- qualified legal/privacy review;
- Data Protection Impact Assessment where required or appropriate;
- Data Protection by Design review;
- cross-border transfer assessment where workloads or personal data could cross jurisdictions;
- DPO applicability assessment;
- security threat modelling;
- signed workload envelopes;
- workload sandboxing and isolation;
- encrypted transport;
- sensitive-workload exclusion;
- result-integrity verification;
- node reputation and abuse controls;
- incident and breach response; and
- evidence that actual Production behavior matches the user disclosure.

## 4. Mobile store distribution

For iOS/iPadOS builds distributed through Apple's App Store and Android builds distributed through Google Play, LANERIQ's policy is:

- Personal Compute may only support the user's own LANERIQ functionality;
- optional compute must respect operating-system power, thermal and background scheduling controls;
- unrelated background compute is prohibited;
- Community Compute is not offered as a mobile-store compute execution capability;
- mobile-store builds must not bypass system power management;
- mobile-store builds must not download executable community workloads outside approved distribution/runtime mechanisms; and
- Low Power or serious thermal conditions must reduce or stop optional compute.

Desktop Community Compute, if introduced later, remains separately consented and separately gated.

## 5. Consent receipt

Where consent is relied upon, LANERIQ should maintain a minimized consent receipt containing only what is reasonably necessary to establish the choice, such as:

- disclosure version;
- purpose (Personal or Community Compute);
- platform/distribution class;
- selected compute mode;
- maximum resource ceiling disclosed;
- background-compute choice;
- timestamp; and
- withdrawal timestamp where applicable.

The consent receipt should not itself become a vehicle for unnecessary profiling.

## 6. Data minimization and purpose limitation

Mother AI Compute must use the minimum data and minimum resource access necessary for the admitted purpose.

Compute permission is not content permission.

Community workloads must not receive sensitive or highly sensitive personal information merely because the user enabled Community Compute. Sensitive workloads must remain local, same-user, or within appropriately trusted LANERIQ/provider infrastructure.

## 7. Cross-border routing

Community workload routing that can involve personal data or legally relevant metadata must not cross borders merely because a remote node is available.

LANERIQ must apply the applicable cross-border transfer assessment and safeguards before enabling such routing in Production.

## 8. Withdrawal

A user must be able to withdraw optional compute consent. Withdrawal must stop future optional compute for that purpose as soon as reasonably practicable, subject only to legally necessary records and in-flight safety/transaction completion boundaries.

## 9. Telemetry

LANERIQ may use minimized technical/security telemetry reasonably necessary for scheduling, thermal protection, reliability, fraud/abuse prevention and incident response.

Such telemetry must not silently become an advertising-tracking or cross-app behavioral profiling system.

## 10. Production legal gate

This draft is an engineering/privacy-by-design specification, not a declaration that all jurisdictions have been legally cleared.

Before Production Community Compute, qualified counsel/privacy professionals must verify the actual data map, consent design, privacy notice, retention, processor/subprocessor relationships, cross-border routes, DPO obligations, breach processes, App Store/Google Play declarations and jurisdiction-specific requirements then in force.
