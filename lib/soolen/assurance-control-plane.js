import { aggregateEvidenceReceipts } from "./evidence-assurance-mesh.js";
import { evaluateCapabilityRisk } from "./capability-risk-graph.js";
import { evaluateSupplyChainClosure } from "./supply-chain-attestation.js";
import { evaluateCampaignReadiness } from "./continuous-evaluation-orchestrator.js";
import { evaluateReleaseBlockers,planBlockerClosure } from "./release-blocker-engine.js";

export const ASSURANCE_CONTROL_PLANE_VERSION="1.0.0";

export function evaluateAssuranceControlPlane(input={}){
  const evidence=aggregateEvidenceReceipts(input.evidenceReceipts||[],{requiredSourceClasses:input.requiredEvidenceSources||[],maxAgeMs:input.evidenceMaxAgeMs});
  const risk=input.riskGraph&&input.riskTargetId?evaluateCapabilityRisk(input.riskGraph,{targetId:input.riskTargetId,incidentSeverity:input.incidentSeverity,maxDepth:input.riskDepth}):Object.freeze({highestRisk:0,highestLevel:"LOW",criticalImpacts:[]});
  const supplyChain=evaluateSupplyChainClosure(input.supplyChainAttestations||[],{requiredTypes:input.requiredSupplyChainTypes,maxAgeMs:input.supplyChainMaxAgeMs});
  const evaluation=evaluateCampaignReadiness(input.evaluationRun||{total:0,passRate:0,averageScore:0},{minimumCases:input.minimumEvaluationCases||10,minimumPassRate:input.minimumEvaluationPassRate??0.95,minimumAverageScore:input.minimumEvaluationScore??85,externalEvidenceRequired:input.externalEvaluationRequired===true});
  const release=evaluateReleaseBlockers({
    githubMainSha:input.githubMainSha,deploymentSha:input.deploymentSha,runtimeSha:input.runtimeSha,requiredGates:input.requiredGates,
    evidenceMeshVerified:evidence.rejectedCount===0&&evidence.missingSources.length===0,
    evidenceFresh:evidence.rejectedCount===0,
    noEvidenceContradictions:evidence.contradictions.length===0,
    supplyChainClosed:supplyChain.closed,
    noCriticalRisk:risk.criticalImpacts.length===0,
    continuousEvaluationReady:evaluation.ready,
    databaseMigrationsVerified:input.databaseMigrationsVerified,durableWritesVerified:input.durableWritesVerified,externalBenchmarkVerified:input.externalBenchmarkVerified,independentAttestationVerified:input.independentAttestationVerified,browserRuntimeVerified:input.browserRuntimeVerified,securityVerified:input.securityVerified,rollbackVerified:input.rollbackVerified,humanApproval:input.humanApproval,
  });
  const blockerPlan=planBlockerClosure(release,input.blockerCatalog||{});
  return Object.freeze({version:ASSURANCE_CONTROL_PLANE_VERSION,evidence,risk,supplyChain,evaluation,release,blockerPlan,productionEligible:release.verdict==="ELIGIBLE",automaticProductionMutationAllowed:false,automaticAuthorityExpansionAllowed:false,humanApprovalRequired:true});
}

export function getAssuranceControlPlaneStatus(){
  return Object.freeze({version:ASSURANCE_CONTROL_PLANE_VERSION,evidenceAssuranceMesh:true,capabilityRiskGraph:true,supplyChainAttestation:true,continuousEvaluation:true,releaseBlockerEngine:true,failClosed:true,productionEvidenceCannotBeSynthesized:true,automaticProductionMutationAllowed:false,humanApprovalRequired:true});
}
