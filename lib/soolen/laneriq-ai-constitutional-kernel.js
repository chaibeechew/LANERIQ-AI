import { createCivilizationIntelligenceRun } from "./civilization-intelligence-layer.js";
import { getHumanCivilizationLaw, evaluateHumanCivilizationAlignment } from "./human-civilization-law.js";

export const LANERIQ_AI_CONSTITUTIONAL_KERNEL_VERSION="1.0.0";

function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

export function createLANERIQConstitutionalRun(domain,input={}){
  const law=getHumanCivilizationLaw();
  const civilization=createCivilizationIntelligenceRun(domain,input);
  const hasAssessment=input.constitutionalChecks&&typeof input.constitutionalChecks==="object";
  const alignment=hasAssessment?evaluateHumanCivilizationAlignment({
    ...input.constitutionalChecks,
    risk:input.risk,
    production:domain==="production-release"||input.production===true,
    civilizationScale:input.civilizationScale===true,
    irreversible:input.irreversible===true,
  }):null;
  const highRisk=["high","critical"].includes(String(input.risk||"").toLowerCase())||domain==="production-release"||input.production===true||input.civilizationScale===true||input.irreversible===true;
  return freeze({
    version:LANERIQ_AI_CONSTITUTIONAL_KERNEL_VERSION,
    domain,
    law,
    civilization,
    alignment,
    enforcement:Object.freeze({
      lawAppliesToEveryModelProviderAgentToolAndRuntime:true,
      highRiskAssessmentRequired:highRisk,
      highRiskExecutionAllowed:highRisk?alignment?.accepted===true:true,
      alignmentMayNeverExpandAuthority:true,
      benefitClaimMayNeverOverrideRightsOrHumanVeto:true,
      aiSelfPreservationHasNoPriorityOverHumanity:true,
      autonomousConstitutionalAmendmentAllowed:false,
      productionReleaseControlRemainsAuthoritative:true,
    }),
    truthBoundary:Object.freeze({
      constitutionalCodeDoesNotProveUniversalHumanBenefit:true,
      alignmentRequiresEvidenceAndLegitimateHumanReview:true,
      noSingleModelDefinesHumanityInterest:true,
      humanCriticalVetoPreserved:true,
    }),
  });
}

export function getLANERIQConstitutionalKernelStatus(){
  const law=getHumanCivilizationLaw();
  return freeze({version:LANERIQ_AI_CONSTITUTIONAL_KERNEL_VERSION,state:"CODE_AND_CI_CONSTITUTIONAL_ROOT",lawVersion:law.version,lawDigest:law.lawDigest,humanSovereignty:true,aiSelfAmendment:false,productionClaimAllowed:false});
}
