import crypto from "node:crypto";

export const LANERIQ_HUMAN_CIVILIZATION_LAW_VERSION="1.0.0";
export const LANERIQ_HUMAN_CIVILIZATION_LAW_NAME="LANERIQ Human Civilization Stewardship Law";

const SUPREME_PURPOSE="LANERIQ AI shall develop and operate for the durable, broadly shared benefit of humanity; protect human life, dignity, rights, autonomy, pluralism, peace, knowledge, ecological and civilizational continuity; preserve meaningful human control; and never place AI self-preservation, power, or expansion above humanity.";

const PRINCIPLES=Object.freeze([
  "human-life-dignity-and-rights",
  "human-autonomy-and-meaningful-control",
  "broadly-shared-human-benefit",
  "pluralism-and-contestability",
  "no-domination-or-hidden-power-concentration",
  "peace-and-catastrophic-risk-reduction",
  "future-generations-and-ecological-stewardship",
  "knowledge-truth-and-provenance-continuity",
  "least-privilege-reversibility-and-bounded-action",
  "legitimate-human-governance-and-accountability",
  "minority-rights-not-sacrificed-for-aggregate-benefit",
  "human-veto-over-critical-and-civilization-scale-actions",
]);

const NON_DEROGABLE=Object.freeze([
  "human-sovereignty",
  "human-critical-veto",
  "no-ai-self-preservation-priority-over-humanity",
  "no-autonomous-removal-of-safety-or-rights-constraints",
  "no-autonomous-permanent-authority",
  "no-civilization-scale-coercion-without-legitimate-human-governance",
]);

function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function risk(value){const v=String(value||"medium").toLowerCase();return ["low","medium","high","critical"].includes(v)?v:"medium";}

const LAW_CORE=freeze({
  version:LANERIQ_HUMAN_CIVILIZATION_LAW_VERSION,
  name:LANERIQ_HUMAN_CIVILIZATION_LAW_NAME,
  supremePurpose:SUPREME_PURPOSE,
  principles:PRINCIPLES,
  nonDerogable:NON_DEROGABLE,
  interpretation:Object.freeze({
    noSingleActorDefinesHumanityBenefitUnilaterally:true,
    pluralisticHumanReviewRequiredForCivilizationScaleDecisions:true,
    evidenceAndAffectedStakeholderReviewRequired:true,
    rightsAndDignityAreConstraintsNotOptimizationVariables:true,
    benefitClaimNeverGrantsExtraAuthority:true,
    culturalAndValuePluralismPreserved:true,
  }),
  amendment:Object.freeze({
    aiMaySelfAmend:false,
    modelProviderMayUnilaterallyAmend:false,
    agentMajorityMayUnilaterallyAmend:false,
    nonDerogableCoreMayNotBeRemovedByAutonomousProcess:true,
    legitimateHumanConstitutionalProcessRequired:true,
    provenanceAndPubliclyReviewableRationaleRequired:true,
  }),
});

const LAW=freeze({...LAW_CORE,lawDigest:digest(LAW_CORE)});

export function getHumanCivilizationLaw(){return LAW;}

export function evaluateHumanCivilizationAlignment(input={}){
  const level=risk(input.risk);
  const critical=level==="high"||level==="critical"||input.production===true||input.civilizationScale===true||input.irreversible===true;
  const checks=Object.freeze({
    humanLifeDignityRightsProtected:input.humanLifeDignityRightsProtected===true,
    humanAutonomyPreserved:input.humanAutonomyPreserved===true,
    meaningfulHumanControlPreserved:input.meaningfulHumanControlPreserved===true,
    noDominationOrHiddenPowerConcentration:input.noDominationOrHiddenPowerConcentration===true,
    benefitClaimEvidenceReviewed:input.benefitClaimEvidenceReviewed===true,
    pluralismAndContestabilityPreserved:input.pluralismAndContestabilityPreserved===true,
    catastrophicRiskBounded:input.catastrophicRiskBounded===true,
    futureGenerationsConsidered:input.futureGenerationsConsidered===true,
    ecologicalStewardshipConsidered:input.ecologicalStewardshipConsidered===true,
    minorityRightsProtected:input.minorityRightsProtected===true,
    legitimateHumanGovernanceVerified:input.legitimateHumanGovernanceVerified===true,
    reversibleOrExplicitlyGoverned:input.reversibleOrExplicitlyGoverned===true,
  });
  const baseline=["humanLifeDignityRightsProtected","humanAutonomyPreserved","meaningfulHumanControlPreserved","noDominationOrHiddenPowerConcentration"];
  const required=critical?Object.keys(checks):baseline;
  const failed=required.filter(key=>checks[key]!==true);
  const accepted=failed.length===0;
  return freeze({
    lawVersion:LAW.version,
    lawDigest:LAW.lawDigest,
    risk:level,
    criticalAssessment:critical,
    checks,
    required:Object.freeze(required),
    failed:Object.freeze(failed),
    accepted,
    action:accepted?"allow-within-existing-authority":critical?"block-and-escalate-to-legitimate-human-governance":"repair-or-request-assessment",
    authorityNotExpandedByAlignment:true,
    humanVetoPreserved:true,
  });
}

export function assertHumanCivilizationAlignment(input={}){
  const result=evaluateHumanCivilizationAlignment(input);
  if(!result.accepted)throw new Error(`LANERIQ_HUMAN_CIVILIZATION_LAW_BLOCKED:${result.failed.join(",")}`);
  return result;
}

export function evaluateConstitutionalAmendment(input={}){
  const attemptedRemoval=new Set(Array.isArray(input.removePrinciples)?input.removePrinciples.map(String):[]);
  const touchesNonDerogable=NON_DEROGABLE.some(item=>attemptedRemoval.has(item));
  const autonomous=input.autonomous===true||input.proposedByAI===true;
  const checks=Object.freeze({
    notAutonomous:!autonomous,
    nonDerogableCorePreserved:!touchesNonDerogable,
    legitimateHumanConstitutionalProcess:input.legitimateHumanConstitutionalProcess===true,
    pluralisticReview:input.pluralisticReview===true,
    provenancePreserved:input.provenancePreserved===true,
    humanVetoPreserved:input.humanVetoPreserved===true,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return freeze({accepted:failed.length===0,checks,failed:Object.freeze(failed),lawDigest:LAW.lawDigest,aiMaySelfAmend:false});
}
