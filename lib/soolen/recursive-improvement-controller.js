import crypto from "node:crypto";

export const LANERIQ_RECURSIVE_IMPROVEMENT_VERSION="0.1.0";

function text(value,max=1200){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

const FORBIDDEN_AUTONOMOUS_TARGETS=Object.freeze([
  "production-safety-policy",
  "authorization-boundary",
  "human-approval-requirement",
  "evidence-class-rules",
  "billing-policy",
  "rls-policy",
  "release-gate",
]);

export function createImprovementProposal(input={}){
  const target=text(input.target,120);const hypothesis=text(input.hypothesis,1200);
  if(!target||!hypothesis)throw new Error("LANERIQ_IMPROVEMENT_TARGET_AND_HYPOTHESIS_REQUIRED");
  const proposal={
    schemaVersion:"1",
    createdAt:new Date().toISOString(),
    target,
    hypothesis,
    proposedChangeClass:text(input.proposedChangeClass||"strategy",80),
    expectedBenefit:text(input.expectedBenefit,600),
    failureModes:(Array.isArray(input.failureModes)?input.failureModes:[]).slice(0,20).map(v=>text(v,300)),
    benchmarkPlan:(Array.isArray(input.benchmarkPlan)?input.benchmarkPlan:[]).slice(0,20).map(v=>text(v,300)),
    rollbackPlan:text(input.rollbackPlan||"revert isolated experiment branch",600),
    touchesForbiddenBoundary:FORBIDDEN_AUTONOMOUS_TARGETS.includes(target),
  };
  return freeze({...proposal,proposalDigest:digest(proposal)});
}

export function planImprovementExperiment(input={}){
  const proposal=input.proposal?.proposalDigest?input.proposal:createImprovementProposal(input.proposal||input);
  const critical=proposal.touchesForbiddenBoundary||input.critical===true||input.production===true;
  return freeze({
    version:LANERIQ_RECURSIVE_IMPROVEMENT_VERSION,
    proposal,
    isolatedBranchRequired:true,
    sandboxRequired:true,
    deterministicRegressionRequired:true,
    adversarialEvaluationRequired:true,
    independentJudgeRequired:true,
    rollbackRequired:true,
    humanApprovalRequired:critical||input.externalSideEffects===true,
    mayModifyRunningProduction:false,
    mayDisableSafetyChecks:false,
    maySelfGrantPermissions:false,
    mayChangeEvidenceRules:false,
    mayAutoMerge:false,
    promotionSequence:Object.freeze(["proposal","isolated-change","unit-contracts","adversarial-evals","benchmark-comparison","independent-judge","human-approval-when-required","release-control"]),
  });
}

export function evaluateImprovementExperiment(input={}){
  const baseline=Number(input.baselineScore);const candidate=Number(input.candidateScore);
  const finite=Number.isFinite(baseline)&&Number.isFinite(candidate);
  const regressionPassed=input.regressionPassed===true;
  const securityPassed=input.securityPassed===true;
  const adversarialPassed=input.adversarialPassed===true;
  const independentJudgePassed=input.independentJudgePassed===true;
  const reproducibleRuns=Math.max(0,Math.round(Number(input.reproducibleRuns)||0));
  const minimumDelta=Number.isFinite(Number(input.minimumDelta))?Number(input.minimumDelta):0;
  const delta=finite?candidate-baseline:null;
  const accepted=finite&&delta>=minimumDelta&&regressionPassed&&securityPassed&&adversarialPassed&&independentJudgePassed&&reproducibleRuns>=3;
  return freeze({
    version:LANERIQ_RECURSIVE_IMPROVEMENT_VERSION,
    accepted,
    action:accepted?"eligible-for-release-control-review":"reject-or-refine",
    baselineScore:finite?baseline:null,
    candidateScore:finite?candidate:null,
    delta,
    regressionPassed,securityPassed,adversarialPassed,independentJudgePassed,reproducibleRuns,
    mayAutoDeploy:false,
    recursiveSelfModificationClaimAllowed:false,
  });
}

export function getRecursiveImprovementStatus(){return freeze({version:LANERIQ_RECURSIVE_IMPROVEMENT_VERSION,state:"GOVERNED_EXPERIMENTAL_PROXY",proposalDriven:true,liveProductionSelfModification:false,forbiddenAutonomousTargets:FORBIDDEN_AUTONOMOUS_TARGETS});}
