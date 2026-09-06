import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const INDEPENDENT_INTELLIGENCE_ATTESTATION_VERSION="1.0.0";
const LAW=getHumanCivilizationLaw();
function text(value,max=500){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function isDigest(value){return /^[a-f0-9]{64}$/.test(String(value||""));}

export function createIndependentBenchmarkAttestation(input={}){
  const providers=[...new Set((Array.isArray(input.providerClasses)?input.providerClasses:[]).map(v=>text(v,120).toLowerCase()).filter(Boolean))];
  const attestor=text(input.attestorClass,120).toLowerCase();
  const judge=text(input.judgeClass,120).toLowerCase();
  const campaignDigest=text(input.campaignDigest,64);const evidenceArtifactDigest=text(input.evidenceArtifactDigest,64);
  const checks=Object.freeze({
    campaignDigestValid:isDigest(campaignDigest),
    evidenceArtifactDigestValid:isDigest(evidenceArtifactDigest),
    atLeastTwoExternalProviders:providers.length>=2,
    realMultiProviderObserved:input.realMultiProviderObserved===true,
    attestorIndependent:Boolean(attestor)&&!providers.includes(attestor),
    judgeIndependent:Boolean(judge)&&!providers.includes(judge)&&judge!==attestor,
    blindEvaluationVerified:input.blindEvaluationVerified===true,
    adversarialCasesIncluded:input.adversarialCasesIncluded===true,
    rawPromptsExcludedFromAttestation:input.rawPromptsIncluded!==true,
    rawOutputsExcludedFromAttestation:input.rawOutputsIncluded!==true,
    signatureVerified:input.signatureVerified===true,
    externalArtifactVerified:input.externalArtifactVerified===true,
    lawDigestCurrent:!input.lawDigest||input.lawDigest===LAW.lawDigest,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  const verified=failed.length===0;
  const core={version:INDEPENDENT_INTELLIGENCE_ATTESTATION_VERSION,campaignDigest,evidenceArtifactDigest,providerClasses:Object.freeze(providers),attestorClass:attestor,judgeClass:judge,checks,failed:Object.freeze(failed),verified,evidenceClass:verified?EVIDENCE_CLASSES.MEASURED_OR_ATTESTED:EVIDENCE_CLASSES.INTERNAL,lawDigest:LAW.lawDigest,mayPromoteToProductionByItself:false,rawPromptPersisted:false,rawOutputPersisted:false};
  return Object.freeze({...core,attestationDigest:digest(core)});
}

export function evaluateExternalBenchmarkClosure(input={}){
  const attestation=input.attestation||{};
  const checks=Object.freeze({independentAttestationVerified:attestation.verified===true,benchmarkPassed:input.benchmarkPassed===true,minimumPassRateMet:Number(input.passRate)>=Number(input.minimumPassRate??.9),minimumScoreMet:Number(input.averageScore)>=Number(input.minimumAverageScore??85),providerDiversityMet:Number(input.distinctExternalProviders)>=2,repeatabilityVerified:input.repeatabilityVerified===true,lawDigestCurrent:attestation.lawDigest===LAW.lawDigest});
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return Object.freeze({closed:failed.length===0,checks,failed:Object.freeze(failed),evidenceClass:failed.length?EVIDENCE_CLASSES.MEASURED_OR_ATTESTED:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,productionClaimAllowed:false,productionEvidenceStillRequiresProductionReleaseControl:true,lawDigest:LAW.lawDigest});
}
