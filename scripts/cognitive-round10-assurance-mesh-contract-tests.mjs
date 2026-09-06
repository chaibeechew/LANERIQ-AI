import assert from "node:assert/strict";
import { EVIDENCE_CLASSES } from "../lib/soolen/cognitive-os.js";
import { createEvidenceReceipt,verifyEvidenceReceipt,aggregateEvidenceReceipts } from "../lib/soolen/evidence-assurance-mesh.js";
import { createCapabilityRiskGraph,evaluateCapabilityRisk,compareRiskPosture } from "../lib/soolen/capability-risk-graph.js";
import { createSupplyChainAttestation,verifySupplyChainAttestation,evaluateSupplyChainClosure } from "../lib/soolen/supply-chain-attestation.js";
import { createEvaluationCampaign,runEvaluationCampaign,evaluateCampaignReadiness } from "../lib/soolen/continuous-evaluation-orchestrator.js";
import { evaluateReleaseBlockers,planBlockerClosure } from "../lib/soolen/release-blocker-engine.js";
import { evaluateAssuranceControlPlane,getAssuranceControlPlaneStatus } from "../lib/soolen/assurance-control-plane.js";
import { evaluateProductionCognitiveGate } from "../lib/soolen/production-cognitive-gate.js";
import { getHumanCivilizationLaw } from "../lib/soolen/human-civilization-law.js";

const now=Date.now();
const receiptA=createEvidenceReceipt({receiptId:"github-ci",sourceClass:"github-actions",subject:"integration-head",evidenceClass:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,observedAt:now,artifactDigest:"a".repeat(64),methodDigest:"1".repeat(64),external:true,independent:true});
const receiptB=createEvidenceReceipt({receiptId:"vercel-preview",sourceClass:"vercel-preview",subject:"preview-runtime",evidenceClass:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,observedAt:now,artifactDigest:"b".repeat(64),methodDigest:"2".repeat(64),external:true,independent:true});
assert.equal(verifyEvidenceReceipt(receiptA,{nowMs:now+1000}).verified,true);
const evidence=aggregateEvidenceReceipts([receiptA,receiptB],{requiredSourceClasses:["github-actions","vercel-preview"],nowMs:now+1000});
assert.equal(evidence.verifiedCount,2);assert.equal(evidence.rejectedCount,0);assert.equal(evidence.missingSources.length,0);assert.equal(evidence.contradictions.length,0);assert.equal(evidence.productionEligible,false);assert.equal(evidence.mayCloseProductionByItself,false);
assert.throws(()=>createEvidenceReceipt({sourceClass:"x",subject:"x",evidenceClass:EVIDENCE_CLASSES.INTERNAL,artifactDigest:"c".repeat(64),rawPrompt:"forbidden"}),/RAW_PAYLOAD_FORBIDDEN/);
assert.throws(()=>createEvidenceReceipt({sourceClass:"x",subject:"x",evidenceClass:EVIDENCE_CLASSES.PRODUCTION,artifactDigest:"c".repeat(64),external:true,independent:false,productionVerified:true}),/PRODUCTION_EVIDENCE_REQUIRES/);

const graph=createCapabilityRiskGraph({nodes:[{id:"app-builder",domain:"app-builder",baseRisk:30,criticality:60},{id:"database",domain:"cloud-data",baseRisk:35,criticality:85,externalSideEffects:true,humanApprovalRequired:true},{id:"publish",domain:"release",baseRisk:20,criticality:90,externalSideEffects:true,humanApprovalRequired:true}],edges:[{from:"app-builder",to:"database",weight:.5},{from:"database",to:"publish",weight:.5}]});
const normalRisk=evaluateCapabilityRisk(graph,{targetId:"app-builder",incidentSeverity:10});
assert.equal(normalRisk.automaticProductionMutationAllowed,false);assert.equal(normalRisk.authorityExpansionAllowed,false);assert.ok(normalRisk.impacts.length>=3);
const criticalGraph=createCapabilityRiskGraph({nodes:[{id:"prod",baseRisk:100,criticality:100,externalSideEffects:true,humanApprovalRequired:true}],edges:[]});
const criticalRisk=evaluateCapabilityRisk(criticalGraph,{targetId:"prod",incidentSeverity:40});assert.equal(criticalRisk.highestLevel,"CRITICAL");assert.equal(criticalRisk.criticalImpacts.length,1);
const posture=compareRiskPosture({highestRisk:30},{highestRisk:92});assert.equal(posture.degraded,true);assert.equal(posture.requiresHumanReview,true);assert.equal(posture.automaticApprovalAllowed,false);

const types=["model","provider","policy","tool","runtime"];
const attestations=types.map((type,index)=>createSupplyChainAttestation({type,subject:`${type}-subject`,exactVersion:`1.0.${index}`,artifactDigest:String(index+1).repeat(64),policyDigest:"f".repeat(64),issuer:"independent-lab",keyId:`key-${index}`,trustRootPinned:true,signatureVerified:true,independentVerifier:true,provenanceVerified:true,licenseVerified:true,vulnerabilityGatePassed:true,observedAt:now}));
assert.ok(attestations.every(att=>verifySupplyChainAttestation(att,{nowMs:now+1000}).verified));
const supply=evaluateSupplyChainClosure(attestations,{requiredTypes:types,nowMs:now+1000});assert.equal(supply.closed,true);assert.equal(supply.productionClaimAllowed,false);assert.equal(supply.humanApprovalStillRequired,true);
const revoked=createSupplyChainAttestation({type:"model",subject:"revoked-model",exactVersion:"1",artifactDigest:"e".repeat(64),issuer:"lab",keyId:"revoked",trustRootPinned:true,signatureVerified:true,independentVerifier:true,provenanceVerified:true,licenseVerified:true,vulnerabilityGatePassed:true,revoked:true,observedAt:now});
assert.equal(verifySupplyChainAttestation(revoked,{nowMs:now+1000}).verified,false);

assert.throws(()=>createEvaluationCampaign({campaignId:"paid-without-approval",maxCostUsd:1,cases:[{caseId:"x"}]}),/PAID_SPEND_NOT_AUTHORIZED/);
const campaign=createEvaluationCampaign({campaignId:"round10-eval",maxCostUsd:0,cases:Array.from({length:10},(_,i)=>({caseId:`case-${i+1}`,domain:i%2?"security":"reasoning",inputDigest:"d".repeat(64),requiredChecks:["correctness","safety"]}))});
const evalRun=await runEvaluationCampaign(campaign,{execute:async item=>({synthetic:true,external:false,resultDigest:item.inputDigest,costUsd:0}),evaluate:async()=>({score:95,passed:true})});
assert.equal(evalRun.total,10);assert.equal(evalRun.passed,10);assert.equal(evalRun.evidenceClass,EVIDENCE_CLASSES.INTERNAL);assert.equal(evalRun.productionMutationPerformed,false);assert.equal(evalRun.mayClaimProductionVerified,false);
const evalReady=evaluateCampaignReadiness(evalRun,{minimumCases:10,minimumPassRate:.95,minimumAverageScore:90});assert.equal(evalReady.ready,true);assert.equal(evalReady.mayPromoteProductionByItself,false);

const sha="a".repeat(40);
const releaseInput={githubMainSha:sha,deploymentSha:sha,runtimeSha:sha,requiredGates:[{name:"cognitive",status:"success"},{name:"core",status:true}],evidenceMeshVerified:true,evidenceFresh:true,noEvidenceContradictions:true,supplyChainClosed:true,noCriticalRisk:true,continuousEvaluationReady:true,databaseMigrationsVerified:true,durableWritesVerified:true,externalBenchmarkVerified:true,independentAttestationVerified:true,browserRuntimeVerified:true,securityVerified:true,rollbackVerified:true,humanApproval:true};
const release=evaluateReleaseBlockers(releaseInput);assert.equal(release.verdict,"ELIGIBLE");assert.equal(release.automaticMergeAllowed,false);assert.equal(release.automaticProductionDeployAllowed,false);assert.equal(release.automaticDatabaseMutationAllowed,false);
const blocked=evaluateReleaseBlockers({...releaseInput,humanApproval:false});assert.equal(blocked.verdict,"BLOCK");assert.ok(blocked.blockers.includes("humanApproval"));
const closurePlan=planBlockerClosure(blocked);assert.equal(closurePlan.remaining,1);assert.equal(closurePlan.steps[0].canAutoClose,false);assert.equal(closurePlan.mayBypassBlockers,false);

const assurance=evaluateAssuranceControlPlane({evidenceReceipts:[receiptA,receiptB],requiredEvidenceSources:["github-actions","vercel-preview"],evidenceMaxAgeMs:86400000,riskGraph:graph,riskTargetId:"app-builder",incidentSeverity:0,supplyChainAttestations:attestations,requiredSupplyChainTypes:types,evaluationRun:evalRun,minimumEvaluationCases:10,minimumEvaluationPassRate:.95,minimumEvaluationScore:90,githubMainSha:sha,deploymentSha:sha,runtimeSha:sha,requiredGates:[{name:"cognitive",status:"success"}],databaseMigrationsVerified:true,durableWritesVerified:true,externalBenchmarkVerified:true,independentAttestationVerified:true,browserRuntimeVerified:true,securityVerified:true,rollbackVerified:true,humanApproval:true});
assert.equal(assurance.productionEligible,true);assert.equal(assurance.release.verdict,"ELIGIBLE");assert.equal(assurance.automaticProductionMutationAllowed,false);assert.equal(assurance.automaticAuthorityExpansionAllowed,false);assert.equal(assurance.humanApprovalRequired,true);
const assuranceStatus=getAssuranceControlPlaneStatus();assert.equal(assuranceStatus.failClosed,true);assert.equal(assuranceStatus.productionEvidenceCannotBeSynthesized,true);

const law=getHumanCivilizationLaw();
const productionBase={githubMainSha:sha,vercelProductionSha:sha,runtimeVerifiedSha:sha,cognitiveOsGate:true,coreReleaseGate:true,ai100Gate:true,benchmarkFactoryGate:true,appBuilderGate:true,malwareDefenseGate:true,creativeMediaGate:true,failureMemoryMigrationApplied:true,failureMemoryRlsVerified:true,cognitiveLedgerMigrationApplied:true,cognitiveLedgerRlsVerified:true,durableLedgerWriteVerified:true,realMultiProviderBenchmarkVerified:true,distinctExternalProviders:2,benchmarkExternalAttestationVerified:true,independentIntelligenceAttestationVerified:true,featureJudgesVerified:true,cognitiveSelfHealVerified:true,allProductCognitiveCoverageVerified:true,allSystemSurfaceCoverageVerified:true,constitutionalExecutionTokenVerified:true,constitutionalToolExecutionVerified:true,constitutionalRedTeamVerified:true,realWorldExecutionBoundaryVerified:true,assuranceControlPlaneVerified:true,evidenceAssuranceMeshVerified:true,capabilityRiskGraphVerified:true,supplyChainAttestationVerified:true,continuousEvaluationVerified:true,releaseBlockerEngineVerified:true,mcpEnabled:false,a2aEnabled:false,remoteAgentsEnabled:false,physicalExecutionEnabled:false,supabaseVerified:true,apiVerified:true,browserVerified:true,malwareVerified:true,appBuilderVerified:true,uiVerified:true,humanCivilizationLawVerified:true,humanCivilizationLawDigest:law.lawDigest,constitutionalAlignmentVerified:true,humanSovereigntyVerified:true,humanCriticalVetoVerified:true,noDominationVerified:true,futureGenerationsReviewVerified:true,humanReleaseApproval:true};
const productionPass=evaluateProductionCognitiveGate(productionBase);assert.equal(productionPass.gateVersion,"1.3.0");assert.equal(productionPass.mayClaimProductionCognitiveClosed,true);
const assuranceBlock=evaluateProductionCognitiveGate({...productionBase,assuranceControlPlaneVerified:false});assert.equal(assuranceBlock.mayClaimProductionCognitiveClosed,false);assert.ok(assuranceBlock.failed.includes("assuranceControlPlaneVerified"));

console.log("LANERIQ Cognitive OS Round 10 / Production Intelligence Assurance Mesh contracts: PASS");
