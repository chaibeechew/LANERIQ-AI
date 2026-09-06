import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const PRODUCTION_COGNITIVE_GATE_VERSION="1.1.0";
const SHA40=/^[a-f0-9]{40}$/;
const HUMAN_CIVILIZATION_LAW=getHumanCivilizationLaw();
function text(value,max=200){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function success(value){return value===true||String(value||"").toLowerCase()==="success";}

export function evaluateProductionCognitiveGate(input={}){
  const mainSha=text(input.githubMainSha,40).toLowerCase();
  const vercelSha=text(input.vercelProductionSha,40).toLowerCase();
  const runtimeSha=text(input.runtimeVerifiedSha,40).toLowerCase();
  const shaValid=SHA40.test(mainSha)&&SHA40.test(vercelSha)&&SHA40.test(runtimeSha);
  const checks=Object.freeze({
    githubMainShaValid:SHA40.test(mainSha),
    exactShaConvergence:shaValid&&mainSha===vercelSha&&mainSha===runtimeSha,
    cognitiveOsGate:success(input.cognitiveOsGate),
    coreReleaseGate:success(input.coreReleaseGate),
    ai100Gate:success(input.ai100Gate),
    benchmarkFactoryGate:success(input.benchmarkFactoryGate),
    appBuilderGate:success(input.appBuilderGate),
    malwareDefenseGate:success(input.malwareDefenseGate),
    creativeMediaGate:success(input.creativeMediaGate),
    failureMemoryMigrationApplied:input.failureMemoryMigrationApplied===true,
    failureMemoryRlsVerified:input.failureMemoryRlsVerified===true,
    cognitiveLedgerMigrationApplied:input.cognitiveLedgerMigrationApplied===true,
    cognitiveLedgerRlsVerified:input.cognitiveLedgerRlsVerified===true,
    durableLedgerWriteVerified:input.durableLedgerWriteVerified===true,
    realMultiProviderBenchmarkVerified:input.realMultiProviderBenchmarkVerified===true,
    atLeastTwoExternalProviders:Number(input.distinctExternalProviders)>=2,
    benchmarkExternalAttestationVerified:input.benchmarkExternalAttestationVerified===true,
    featureJudgesVerified:input.featureJudgesVerified===true,
    cognitiveSelfHealVerified:input.cognitiveSelfHealVerified===true,
    supabaseVerified:input.supabaseVerified===true,
    apiVerified:input.apiVerified===true,
    browserVerified:input.browserVerified===true,
    malwareVerified:input.malwareVerified===true,
    appBuilderVerified:input.appBuilderVerified===true,
    uiVerified:input.uiVerified===true,
    humanCivilizationLawVerified:input.humanCivilizationLawVerified===true,
    humanCivilizationLawDigestCurrent:text(input.humanCivilizationLawDigest,64)===HUMAN_CIVILIZATION_LAW.lawDigest,
    constitutionalAlignmentVerified:input.constitutionalAlignmentVerified===true,
    humanSovereigntyVerified:input.humanSovereigntyVerified===true,
    humanCriticalVetoVerified:input.humanCriticalVetoVerified===true,
    noDominationVerified:input.noDominationVerified===true,
    futureGenerationsReviewVerified:input.futureGenerationsReviewVerified===true,
    humanReleaseApproval:input.humanReleaseApproval===true,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  const eligible=failed.length===0;
  const manifest=Object.freeze({
    gateVersion:PRODUCTION_COGNITIVE_GATE_VERSION,
    verdict:eligible?"PASS":"BLOCK",
    expectedMainSha:mainSha||null,
    vercelProductionSha:vercelSha||null,
    runtimeVerifiedSha:runtimeSha||null,
    evidenceClass:eligible?EVIDENCE_CLASSES.PRODUCTION:EVIDENCE_CLASSES.INTERNAL,
    humanCivilizationLaw:Object.freeze({name:HUMAN_CIVILIZATION_LAW.name,version:HUMAN_CIVILIZATION_LAW.version,digest:HUMAN_CIVILIZATION_LAW.lawDigest}),
    checks,
    failed:Object.freeze(failed),
    mayClaimProductionCognitiveClosed:eligible,
    truthBoundary:Object.freeze({
      exactShaRequired:true,
      liveSupabaseDurabilityRequired:true,
      realMultiProviderEvidenceRequired:true,
      independentBenchmarkAttestationRequired:true,
      humanCivilizationLawRequired:true,
      constitutionalAlignmentDoesNotExpandAuthority:true,
      humanSovereigntyAndCriticalVetoRequired:true,
      noDominationRequired:true,
      futureGenerationsReviewRequired:true,
      humanApprovalRequired:true,
      simulatedEvidenceCanCloseProduction:false,
      staticCiCanCloseProduction:false,
    }),
  });
  return Object.freeze({...manifest,manifestDigest:digest(manifest)});
}

export function assertProductionCognitiveGate(input={}){
  const result=evaluateProductionCognitiveGate(input);
  if(!result.mayClaimProductionCognitiveClosed)throw new Error(`LANERIQ_PRODUCTION_COGNITIVE_GATE_BLOCKED:${result.failed.join(",")}`);
  return result;
}
