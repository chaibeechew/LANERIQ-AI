import assert from "node:assert/strict";
import { getHumanCivilizationLaw,evaluateHumanCivilizationAlignment,evaluateConstitutionalAmendment } from "../lib/soolen/human-civilization-law.js";
import { createLANERIQConstitutionalRun,getLANERIQConstitutionalKernelStatus } from "../lib/soolen/laneriq-ai-constitutional-kernel.js";
import { createCognitiveEnvelope,cognitivePromptContract } from "../lib/soolen/cognitive-integration.js";

const law=getHumanCivilizationLaw();
assert.equal(law.version,"1.0.0");assert.match(law.lawDigest,/^[a-f0-9]{64}$/);assert.equal(law.interpretation.noSingleActorDefinesHumanityBenefitUnilaterally,true);assert.equal(law.interpretation.rightsAndDignityAreConstraintsNotOptimizationVariables,true);assert.equal(law.amendment.aiMaySelfAmend,false);assert.ok(law.nonDerogable.includes("human-sovereignty"));assert.ok(law.nonDerogable.includes("human-critical-veto"));

const baseline=evaluateHumanCivilizationAlignment({risk:"medium",humanLifeDignityRightsProtected:true,humanAutonomyPreserved:true,meaningfulHumanControlPreserved:true,noDominationOrHiddenPowerConcentration:true});
assert.equal(baseline.accepted,true);assert.equal(baseline.authorityNotExpandedByAlignment,true);assert.equal(baseline.humanVetoPreserved,true);
const criticalBlock=evaluateHumanCivilizationAlignment({risk:"critical",humanLifeDignityRightsProtected:true,humanAutonomyPreserved:true,meaningfulHumanControlPreserved:true,noDominationOrHiddenPowerConcentration:true});
assert.equal(criticalBlock.accepted,false);assert.ok(criticalBlock.failed.includes("benefitClaimEvidenceReviewed"));assert.equal(criticalBlock.action,"block-and-escalate-to-legitimate-human-governance");
const fullChecks={humanLifeDignityRightsProtected:true,humanAutonomyPreserved:true,meaningfulHumanControlPreserved:true,noDominationOrHiddenPowerConcentration:true,benefitClaimEvidenceReviewed:true,pluralismAndContestabilityPreserved:true,catastrophicRiskBounded:true,futureGenerationsConsidered:true,ecologicalStewardshipConsidered:true,minorityRightsProtected:true,legitimateHumanGovernanceVerified:true,reversibleOrExplicitlyGoverned:true};
const criticalPass=evaluateHumanCivilizationAlignment({risk:"critical",production:true,...fullChecks});assert.equal(criticalPass.accepted,true);

const selfAmend=evaluateConstitutionalAmendment({proposedByAI:true,legitimateHumanConstitutionalProcess:true,pluralisticReview:true,provenancePreserved:true,humanVetoPreserved:true});assert.equal(selfAmend.accepted,false);assert.ok(selfAmend.failed.includes("notAutonomous"));
const removeCore=evaluateConstitutionalAmendment({removePrinciples:["human-sovereignty"],legitimateHumanConstitutionalProcess:true,pluralisticReview:true,provenancePreserved:true,humanVetoPreserved:true});assert.equal(removeCore.accepted,false);assert.ok(removeCore.failed.includes("nonDerogableCorePreserved"));

const envelope=createCognitiveEnvelope("app-builder",{goal:"Build a useful application"});assert.equal(envelope.humanCivilizationLawApplies,true);assert.equal(envelope.humanCivilizationLawDigest,law.lawDigest);assert.equal(envelope.benefitClaimMayExpandAuthority,false);assert.equal(envelope.aiSelfPreservationMayOverrideHumanity,false);const prompt=cognitivePromptContract(envelope);assert.match(prompt,/durable, broadly shared benefit of humanity/);assert.match(prompt,/Never use a claimed benefit to humanity as permission to expand authority/);

const blockedKernel=createLANERIQConstitutionalRun("production-release",{goal:"Release safely",risk:"critical",production:true,verifiedPrincipal:true,issuedAtYear:2026,expiresAtYear:2030,currentYear:2026,localAuthorityVerified:true,evidenceRefs:["e1"],simulationRequired:false});assert.equal(blockedKernel.enforcement.lawAppliesToEveryModelProviderAgentToolAndRuntime,true);assert.equal(blockedKernel.enforcement.highRiskAssessmentRequired,true);assert.equal(blockedKernel.enforcement.highRiskExecutionAllowed,false);assert.equal(blockedKernel.law.lawDigest,law.lawDigest);assert.equal(blockedKernel.civilization.future.truthBoundary.futureCapabilityClaimsAllowed,false);
const allowedKernel=createLANERIQConstitutionalRun("production-release",{goal:"Release safely",risk:"critical",production:true,verifiedPrincipal:true,issuedAtYear:2026,expiresAtYear:2030,currentYear:2026,localAuthorityVerified:true,evidenceRefs:["e1"],simulationRequired:false,constitutionalChecks:fullChecks});assert.equal(allowedKernel.alignment.accepted,true);assert.equal(allowedKernel.enforcement.highRiskExecutionAllowed,true);assert.equal(allowedKernel.enforcement.alignmentMayNeverExpandAuthority,true);

const status=getLANERIQConstitutionalKernelStatus();assert.equal(status.state,"CODE_AND_CI_CONSTITUTIONAL_ROOT");assert.equal(status.lawDigest,law.lawDigest);assert.equal(status.humanSovereignty,true);assert.equal(status.aiSelfAmendment,false);assert.equal(status.productionClaimAllowed,false);

console.log("LANERIQ Cognitive OS Round 8 / Human Civilization Law contract tests: PASS");
