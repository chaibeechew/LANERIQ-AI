import crypto from "node:crypto";

export const RELEASE_BLOCKER_ENGINE_VERSION="1.0.0";
const SHA40=/^[a-f0-9]{40}$/;
function text(value,max=160){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function ok(value){return value===true||String(value||"").toLowerCase()==="success";}

export function evaluateReleaseBlockers(input={}){
  const mainSha=text(input.githubMainSha,40).toLowerCase();const deploymentSha=text(input.deploymentSha,40).toLowerCase();const runtimeSha=text(input.runtimeSha,40).toLowerCase();
  const requiredGates=Array.isArray(input.requiredGates)?input.requiredGates:[];const gateFailures=requiredGates.filter(row=>!ok(row?.status)).map(row=>text(row?.name,100)||"unnamed-gate");
  const checks=Object.freeze({
    mainShaValid:SHA40.test(mainSha),
    exactShaConverged:SHA40.test(mainSha)&&mainSha===deploymentSha&&mainSha===runtimeSha,
    requiredGatesPassed:gateFailures.length===0,
    evidenceMeshVerified:input.evidenceMeshVerified===true,
    evidenceFresh:input.evidenceFresh===true,
    noEvidenceContradictions:input.noEvidenceContradictions===true,
    supplyChainClosed:input.supplyChainClosed===true,
    noCriticalRisk:input.noCriticalRisk===true,
    continuousEvaluationReady:input.continuousEvaluationReady===true,
    databaseMigrationsVerified:input.databaseMigrationsVerified===true,
    durableWritesVerified:input.durableWritesVerified===true,
    externalBenchmarkVerified:input.externalBenchmarkVerified===true,
    independentAttestationVerified:input.independentAttestationVerified===true,
    browserRuntimeVerified:input.browserRuntimeVerified===true,
    securityVerified:input.securityVerified===true,
    rollbackVerified:input.rollbackVerified===true,
    humanApproval:input.humanApproval===true,
  });
  const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
  const blockers=[...failed,...gateFailures.map(name=>`gate:${name}`)];
  const eligible=blockers.length===0;
  const body=Object.freeze({version:RELEASE_BLOCKER_ENGINE_VERSION,verdict:eligible?"ELIGIBLE":"BLOCK",githubMainSha:mainSha||null,deploymentSha:deploymentSha||null,runtimeSha:runtimeSha||null,checks,blockers:Object.freeze(blockers),automaticMergeAllowed:false,automaticProductionDeployAllowed:false,automaticDatabaseMutationAllowed:false,humanApprovalRequired:true});
  return Object.freeze({...body,decisionDigest:digest(body)});
}

export function planBlockerClosure(result={},catalog={}){
  const steps=(result.blockers||[]).map(blocker=>Object.freeze({blocker,owner:text(catalog?.[blocker]?.owner,80)||"Production Release Control",action:text(catalog?.[blocker]?.action,200)||`Collect and independently verify evidence for ${blocker}`,canAutoClose:false,requiresNewEvidence:true}));
  return Object.freeze({verdict:result.verdict||"BLOCK",steps:Object.freeze(steps),remaining:steps.length,mayBypassBlockers:false,mayLowerGates:false,planDigest:digest(steps)});
}

export function assertReleaseEligible(input={}){
  const result=evaluateReleaseBlockers(input);if(result.verdict!=="ELIGIBLE")throw new Error(`LANERIQ_RELEASE_BLOCKED:${result.blockers.join(",")}`);return result;
}
