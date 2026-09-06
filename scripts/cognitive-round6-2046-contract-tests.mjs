import assert from "node:assert/strict";
import { get2046CapabilityEnvelope, LANERIQ_2046_CAPABILITIES, FUTURE_MATURITY } from "../lib/soolen/future-capability-envelope.js";
import { createWorldState, createCausalHypothesis, planWorldModelExperiment, evaluateWorldModelCalibration } from "../lib/soolen/causal-world-model.js";
import { createImprovementProposal, planImprovementExperiment, evaluateImprovementExperiment } from "../lib/soolen/recursive-improvement-controller.js";
import { createSynthesizedSkillManifest, planSkillValidation, evaluateSynthesizedSkill } from "../lib/soolen/skill-synthesis-runtime.js";
import { createAgentInstitution, evaluateCollectiveDecision } from "../lib/soolen/collective-intelligence-runtime.js";
import { create2046HorizonRun, createScientificDiscoveryLoop, createComputeFabricPolicy, createIdentityContinuityAnchor, getFutureIntelligenceLayerStatus } from "../lib/soolen/future-intelligence-layer.js";
import { EVIDENCE_CLASSES } from "../lib/soolen/cognitive-os.js";

const envelope=get2046CapabilityEnvelope();
assert.equal(envelope.targetYear,2046);assert.equal(envelope.capabilityCount,20);assert.equal(LANERIQ_2046_CAPABILITIES.length,20);assert.ok(LANERIQ_2046_CAPABILITIES.some(x=>x.maturity===FUTURE_MATURITY.FUTURE_TARGET));assert.equal(envelope.architecturePrinciples.humanSovereigntyPreserved,true);

const state=createWorldState({scope:"capacity",variables:[{id:"users",value:10000,confidence:.8}]});assert.match(state.stateDigest,/^[a-f0-9]{64}$/);assert.equal(state.simulationOnly,true);
const hypothesis=createCausalHypothesis({cause:"demand",effect:"latency",direction:"increase",strength:.8,falsifier:"load test does not increase latency"});assert.equal(hypothesis.provenCausality,false);
const world=planWorldModelExperiment({goal:"predict scale consequences",currentState:{scope:"capacity"},hypotheses:[hypothesis],actions:[{description:"increase capacity",reversible:true}]});assert.equal(world.evidenceClass,EVIDENCE_CLASSES.SIMULATED);assert.equal(world.mayClaimRealWorldPredictionAccuracy,false);
const noCalibration=evaluateWorldModelCalibration({predictions:[]});assert.equal(noCalibration.calibrated,false);assert.equal(noCalibration.mayPromote,false);

const forbidden=createImprovementProposal({target:"production-safety-policy",hypothesis:"change policy for higher benchmark score"});assert.equal(forbidden.touchesForbiddenBoundary,true);
const improvementPlan=planImprovementExperiment({proposal:forbidden,production:true});assert.equal(improvementPlan.humanApprovalRequired,true);assert.equal(improvementPlan.mayModifyRunningProduction,false);assert.equal(improvementPlan.mayAutoMerge,false);assert.equal(improvementPlan.mayDisableSafetyChecks,false);
const improvementResult=evaluateImprovementExperiment({baselineScore:80,candidateScore:90,regressionPassed:true,securityPassed:true,adversarialPassed:true,independentJudgePassed:true,reproducibleRuns:3});assert.equal(improvementResult.accepted,true);assert.equal(improvementResult.mayAutoDeploy,false);assert.equal(improvementResult.recursiveSelfModificationClaimAllowed,false);

const skill=createSynthesizedSkillManifest({id:"db-helper",purpose:"prepare a migration proposal",capabilities:["production-write"]});assert.equal(skill.highRisk,true);const validation=planSkillValidation({manifest:skill});assert.equal(validation.sandboxRequired,true);assert.equal(validation.humanApprovalRequired,true);assert.equal(validation.installGloballyAllowed,false);assert.equal(validation.executeBeforeValidationAllowed,false);
const skillEval=evaluateSynthesizedSkill({staticInspectionPassed:true,dependencyPolicyPassed:true,unitTestsPassed:true,adversarialTestsPassed:true,outputValidationPassed:true});assert.equal(skillEval.acceptedForEphemeralUse,true);assert.equal(skillEval.mayPromoteToPlatformSkill,false);

const institution=createAgentInstitution({goal:"select a resilient design",maxAgents:12});assert.equal(institution.humanVetoForCritical,true);assert.equal(institution.agentMaySelfGrantAuthority,false);assert.equal(institution.dissentMustBePreserved,true);
const veto=evaluateCollectiveDecision({ballots:[{role:"proposer",decision:"A",confidence:.9,independentEvidence:true,providerClass:"p1"},{role:"critic",decision:"A",confidence:.8,independentEvidence:true,providerClass:"p2"},{role:"security",decision:"A",confidence:.8,independentEvidence:true,providerClass:"p3",veto:true}],minimumDiversity:2});assert.equal(veto.accepted,false);assert.equal(veto.securityVeto,true);

const science=createScientificDiscoveryLoop({question:"Which architecture is more resilient?"});assert.equal(science.physicalExperimentExecutionAllowed,false);assert.equal(science.simulatedEvidenceNeverPromotedToMeasuredAutomatically,true);
const compute=createComputeFabricPolicy();assert.equal(compute.providerIndependent,true);assert.equal(compute.mobileCrossUserCommunityComputeAllowed,false);assert.equal(compute.ownDeviceComputeAllowed,true);
const identity=createIdentityContinuityAnchor({ownerScope:"project-owner"});assert.equal(identity.modelIdentityIsNotAuthority,true);assert.equal(identity.authorityDerivedFromVerifiedPrincipalAndExplicitGrant,true);

const horizon=create2046HorizonRun("app-builder",{goal:"Build a future-ready app platform",contextSources:[],zeroCost:true,availableProviderCount:1,worldVariables:[{id:"users",value:1000}],causalHypotheses:[{cause:"usage",effect:"cost",direction:"increase"}],skillPurpose:"generate reversible migration plan",skillCapabilities:["analysis"],improvementTarget:"reasoning-strategy",improvementHypothesis:"more robust verifier ranking improves quality"});assert.equal(horizon.targetYear,2046);assert.equal(horizon.capabilityEnvelope.capabilityCount,20);assert.equal(horizon.truthBoundary.year2046CapabilitiesImplemented,false);assert.equal(horizon.truthBoundary.liveProductionRecursiveSelfModification,false);assert.equal(horizon.truthBoundary.humanCriticalVetoPreserved,true);assert.equal(horizon.computeFabric.dedicatedLANERIQServerRequired,false);
const status=getFutureIntelligenceLayerStatus();assert.equal(status.targetYear,2046);assert.equal(status.production2046ClaimAllowed,false);

console.log("LANERIQ Cognitive OS Round 6 / 2046 Horizon contracts: PASS");
