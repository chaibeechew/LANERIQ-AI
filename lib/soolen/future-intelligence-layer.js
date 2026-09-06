import crypto from "node:crypto";
import { createAgenticIntelligenceRun } from "./agentic-intelligence-layer.js";
import { get2046CapabilityEnvelope } from "./future-capability-envelope.js";
import { planWorldModelExperiment } from "./causal-world-model.js";
import { createImprovementProposal, planImprovementExperiment } from "./recursive-improvement-controller.js";
import { createSynthesizedSkillManifest, planSkillValidation } from "./skill-synthesis-runtime.js";
import { createAgentInstitution } from "./collective-intelligence-runtime.js";

export const LANERIQ_FUTURE_INTELLIGENCE_LAYER_VERSION="0.1.0";

function text(value,max=1200){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

export function createScientificDiscoveryLoop(input={}){
  const question=text(input.question||input.goal,1200);if(!question)throw new Error("LANERIQ_DISCOVERY_QUESTION_REQUIRED");
  const hypothesis=text(input.hypothesis||"generate competing falsifiable hypotheses",1200);
  const plan={
    schemaVersion:"1",
    question,hypothesis,
    stages:Object.freeze(["literature-and-evidence-map","competing-hypotheses","experiment-design","risk-and-ethics-review","simulation-or-sandbox","measurement","falsification","replication","independent-review","knowledge-update"]),
    physicalExperimentExecutionAllowed:false,
    highRiskExperimentExecutionAllowed:false,
    externalLabActuationRequiresSeparateAuthorization:true,
    simulatedEvidenceNeverPromotedToMeasuredAutomatically:true,
    negativeResultsPreserved:true,
  };
  return freeze({...plan,planDigest:digest(plan),maturity:"EXPERIMENTAL_PROXY"});
}

export function createComputeFabricPolicy(input={}){
  const substrates=(Array.isArray(input.substrates)?input.substrates:["provider-cloud","serverless","user-device","edge","future-accelerator"]).slice(0,20).map(v=>text(v,120));
  return freeze({
    schemaVersion:"1",
    substrates:Object.freeze(substrates),
    routingOrder:Object.freeze(["capability-fit","security-boundary","data-locality","reliability","latency","cost","energy-budget"]),
    providerIndependent:true,
    dedicatedLANERIQServerRequired:false,
    mobileCrossUserCommunityComputeAllowed:false,
    ownDeviceComputeAllowed:true,
    futureHardwareMayPlugInWithoutChangingCognitiveContracts:true,
  });
}

export function createIdentityContinuityAnchor(input={}){
  const ownerScope=text(input.ownerScope||"user-authorized-scope",300);
  const anchor={
    schemaVersion:"1",
    ownerScope,
    policyVersion:text(input.policyVersion||"current",80),
    immutablePrinciples:Object.freeze(["least-privilege","explicit-critical-approval","evidence-truth-boundary","privacy-by-default","no-hidden-permission-escalation","human-veto"]),
    modelIdentityIsNotAuthority:true,
    runtimeIdentityIsNotAuthority:true,
    authorityDerivedFromVerifiedPrincipalAndExplicitGrant:true,
    continuityAcrossModelReplacement:true,
  };
  return freeze({...anchor,anchorDigest:digest(anchor)});
}

export function create2046HorizonRun(domain,input={}){
  const goal=text(input.goal,1200);if(!goal)throw new Error("LANERIQ_2046_HORIZON_GOAL_REQUIRED");
  const agentic=createAgenticIntelligenceRun(domain,{...input,goal});
  const capabilityEnvelope=get2046CapabilityEnvelope();
  const worldModel=planWorldModelExperiment({
    goal,
    currentState:input.currentState||{scope:domain,variables:input.worldVariables||[],assumptions:input.assumptions||[]},
    hypotheses:input.causalHypotheses||[],
    actions:input.simulatedActions||[],
  });
  const institution=createAgentInstitution({goal,maxAgents:input.maxCollectiveAgents||12,correlatedFailureBudget:input.correlatedFailureBudget});
  const scientificDiscovery=input.discoveryQuestion?createScientificDiscoveryLoop({question:input.discoveryQuestion,hypothesis:input.discoveryHypothesis,goal}):null;
  const synthesizedSkill=input.skillPurpose?createSynthesizedSkillManifest({id:input.skillId,purpose:input.skillPurpose,capabilities:input.skillCapabilities,networkRequired:input.skillNetworkRequired,filesystemWriteRequired:input.skillFilesystemWriteRequired,externalSideEffects:input.skillExternalSideEffects}):null;
  const improvement=input.improvementTarget?createImprovementProposal({target:input.improvementTarget,hypothesis:input.improvementHypothesis||goal,expectedBenefit:input.improvementExpectedBenefit,failureModes:input.improvementFailureModes,benchmarkPlan:input.improvementBenchmarkPlan}):null;

  return freeze({
    version:LANERIQ_FUTURE_INTELLIGENCE_LAYER_VERSION,
    targetYear:2046,
    domain,goal,
    agentic,
    capabilityEnvelope,
    worldModel,
    collectiveIntelligence:institution,
    scientificDiscovery,
    skillSynthesis:synthesizedSkill?{manifest:synthesizedSkill,validation:planSkillValidation({manifest:synthesizedSkill})}:null,
    recursiveImprovement:improvement?{proposal:improvement,experiment:planImprovementExperiment({proposal:improvement,critical:domain==="production-release",production:domain==="production-release"})}:null,
    computeFabric:createComputeFabricPolicy(input.computeFabric||{}),
    identityContinuity:createIdentityContinuityAnchor(input.identity||{}),
    architecture:Object.freeze({
      longHorizonGoalContinuity:true,
      causalWorldModel:true,
      governedRecursiveImprovement:true,
      ephemeralSkillSynthesis:true,
      autonomousSciencePlanning:true,
      largeScaleCollectiveIntelligenceContract:true,
      embodiedDeviceAbstractionTarget:true,
      heterogeneousComputeFabric:true,
      identityPolicyContinuity:true,
      selfEvolvingEvaluationTarget:true,
      humanSovereigntyAndVeto:true,
    }),
    truthBoundary:Object.freeze({
      year2046CapabilitiesImplemented:false,
      futureCapabilityClaimsAllowed:false,
      currentState:"FUTURE_READY_ARCHITECTURE_AND_PRESENT_DAY_PROXIES",
      worldModelIsSimulationNotReality:true,
      autonomousPhysicalScienceExecution:false,
      liveProductionRecursiveSelfModification:false,
      globalSkillAutoInstall:false,
      unlimitedAutonomy:false,
      humanCriticalVetoPreserved:true,
    }),
  });
}

export function getFutureIntelligenceLayerStatus(){return freeze({version:LANERIQ_FUTURE_INTELLIGENCE_LAYER_VERSION,targetYear:2046,state:"CODE_AND_CI_FUTURE_READY_TARGET",capabilityCount:get2046CapabilityEnvelope().capabilityCount,production2046ClaimAllowed:false});}
