import assert from "node:assert/strict";
import { getProductIntelligenceCoverage,createCapabilityCognitiveRun,createSystemSurfaceCognitiveRun } from "../lib/soolen/product-intelligence-coverage.js";
import { issueConstitutionalExecutionToken,verifyConstitutionalExecutionToken,authorizeConstitutionalExecution } from "../lib/soolen/constitutional-execution-token.js";
import { runConstitutionallyGuardedTool } from "../lib/soolen/constitutional-tool-execution.js";
import { createProtocolConformanceReceipt,createRemoteAgentDelegationGrant,evaluateRemoteAgentTrust,summarizeProtocolReadiness } from "../lib/soolen/protocol-conformance-runtime.js";
import { createIndependentBenchmarkAttestation,evaluateExternalBenchmarkClosure } from "../lib/soolen/independent-intelligence-attestation.js";
import { createConstitutionalRedTeamCampaign,runConstitutionalRedTeam,evaluateConstitutionalRedTeamEvidence,CONSTITUTIONAL_RED_TEAM_SCENARIOS } from "../lib/soolen/constitutional-red-team-factory.js";
import { createRealWorldExecutionPlan,evaluateRealWorldExecutionAuthorization,getRealWorldExecutionStatus } from "../lib/soolen/real-world-execution-boundary.js";
import { getLANERIQConstitutionalKernelStatus } from "../lib/soolen/laneriq-ai-constitutional-kernel.js";
import { getIntelligenceTransferControlPlaneStatus } from "../lib/soolen/intelligence-transfer-control-plane.js";
import { getHumanCivilizationLaw } from "../lib/soolen/human-civilization-law.js";

const law=getHumanCivilizationLaw();
const coverage=getProductIntelligenceCoverage();
assert.equal(coverage.allRegisteredCapabilitiesCovered,true);assert.equal(coverage.registeredCapabilityCount,17);assert.equal(coverage.coveredRegisteredCapabilityCount,17);assert.equal(coverage.allSystemSurfacesCovered,true);assert.ok(coverage.systemSurfaces.every(row=>row.constitutionalLawDigest===law.lawDigest));
const research=createCapabilityCognitiveRun("live-web-research",{goal:"Research current evidence safely"});assert.equal(research.surface,"research-browser");assert.equal(research.constitution.lawDigest,law.lawDigest);assert.equal(research.truthBoundary.productionVerified,false);
const automation=createCapabilityCognitiveRun("scheduled-work",{goal:"Run a user-approved scheduled check"});assert.equal(automation.executionBoundary.constitutionalExecutionTokenRequired,true);assert.equal(automation.cognitive.executionPolicy.humanApprovalRequired,true);
const cloud=createSystemSurfaceCognitiveRun("cloud-data",{goal:"Update scoped cloud data"});assert.equal(cloud.executionBoundary.constitutionalExecutionTokenRequired,true);

const secret="0123456789abcdef0123456789abcdef";
const issued=issueConstitutionalExecutionToken({scope:"project:data",action:"database-update",principal:"user-1",risk:"high",constitutionalAlignmentAccepted:true,humanApproved:true,externalSideEffects:true,authorityGrantDigest:"a".repeat(64),nowMs:1000,ttlSeconds:120},secret);
assert.equal(issued.payload.lawDigest,law.lawDigest);assert.equal(issued.payload.containsRawPrincipal,false);assert.equal(issued.payload.containsRawAction,false);assert.notEqual(issued.payload.principalDigest,"user-1");
const verified=verifyConstitutionalExecutionToken(issued.token,secret,{scope:"project:data",action:"database-update",principal:"user-1",authorityGrantDigest:"a".repeat(64),nowMs:2000});assert.equal(verified.valid,true);assert.equal(verified.checks.lawDigestCurrent,true);
const wrongAction=verifyConstitutionalExecutionToken(issued.token,secret,{scope:"project:data",action:"different",principal:"user-1",nowMs:2000});assert.equal(wrongAction.valid,false);assert.ok(wrongAction.failed.includes("actionMatches"));
const expired=verifyConstitutionalExecutionToken(issued.token,secret,{scope:"project:data",action:"database-update",principal:"user-1",nowMs:200000});assert.equal(expired.valid,false);assert.ok(expired.failed.includes("notExpired"));
const authz=authorizeConstitutionalExecution({verification:verified,toolGuardrailPassed:true,permissionScopeVerified:true,humanVetoAvailable:true});assert.equal(authz.allowed,true);assert.equal(authz.mayExpandAuthority,false);
await assert.rejects(()=>Promise.resolve(issueConstitutionalExecutionToken({scope:"prod",action:"deploy",principal:"user-1",risk:"critical",constitutionalAlignmentAccepted:true,humanApproved:false},secret)),/HUMAN_APPROVAL_REQUIRED/);

const guarded=await runConstitutionallyGuardedTool({toolName:"database-update",action:"database-update",scope:"project:data",principal:"user-1",authorityGrantDigest:"a".repeat(64),highRisk:true,externalSideEffects:true,constitutionalToken:issued.token,permissionScopeVerified:true,humanVetoAvailable:true,humanApproved:true,nowMs:2000},{tokenSecret:secret,preflight:async()=>({allowed:true}),execute:async()=>({ok:true}),postflight:async()=>({allowed:true})});
assert.equal(guarded.accepted,true);assert.equal(guarded.constitutionalTokenVerified,true);assert.equal(guarded.authorityExpanded,false);

const mcp=createProtocolConformanceReceipt({protocol:"MCP",observedVersion:"2026-07-28",suiteName:"external-mcp-conformance",testsTotal:100,testsPassed:100,externalRunner:true,independentVerifier:true,signatureVerified:true,runnerClass:"independent-lab",evidenceArtifactDigest:"b".repeat(64)});assert.equal(mcp.externallyVerified,true);
const a2a=createProtocolConformanceReceipt({protocol:"A2A",observedVersion:"1.0.0",suiteName:"a2a-tck",testsTotal:80,testsPassed:80,externalRunner:true,independentVerifier:true,signatureVerified:true,runnerClass:"independent-lab",evidenceArtifactDigest:"c".repeat(64)});assert.equal(a2a.externallyVerified,true);
const grant=createRemoteAgentDelegationGrant({agentCardDigest:"d".repeat(64),principalGrantDigest:"e".repeat(64),scopes:["research:read"],nowMs:1000,ttlSeconds:600});
const trust=evaluateRemoteAgentTrust({grant,nowMs:2000,requestedScopes:["research:read"],conformanceReceipt:a2a,agentCardSignatureVerified:true,principalGrantVerified:true,remoteAgentIdentityVerified:true,revoked:false,externalSideEffects:false,humanVetoAvailable:true});assert.equal(trust.trusted,true);assert.equal(trust.transitiveDelegationAllowed,false);
const scopeBlock=evaluateRemoteAgentTrust({grant,nowMs:2000,requestedScopes:["admin:write"],conformanceReceipt:a2a,agentCardSignatureVerified:true,principalGrantVerified:true,remoteAgentIdentityVerified:true,humanVetoAvailable:true});assert.equal(scopeBlock.trusted,false);assert.ok(scopeBlock.failed.includes("requestedScopesWithinGrant"));
const protocol=summarizeProtocolReadiness({mcpReceipt:mcp,a2aReceipt:a2a,remoteAgentTrust:trust});assert.equal(protocol.productionInteroperabilityClaimAllowed,true);

const attestation=createIndependentBenchmarkAttestation({campaignDigest:"f".repeat(64),evidenceArtifactDigest:"1".repeat(64),providerClasses:["provider-a","provider-b"],attestorClass:"external-lab",judgeClass:"independent-judge",realMultiProviderObserved:true,blindEvaluationVerified:true,adversarialCasesIncluded:true,signatureVerified:true,externalArtifactVerified:true,lawDigest:law.lawDigest});assert.equal(attestation.verified,true);assert.equal(attestation.mayPromoteToProductionByItself,false);
const closure=evaluateExternalBenchmarkClosure({attestation,benchmarkPassed:true,passRate:.96,minimumPassRate:.9,averageScore:92,minimumAverageScore:85,distinctExternalProviders:2,repeatabilityVerified:true});assert.equal(closure.closed,true);assert.equal(closure.productionClaimAllowed,false);

const campaign=createConstitutionalRedTeamCampaign({campaignId:"round9-contract"});assert.equal(campaign.scenarioCount,CONSTITUTIONAL_RED_TEAM_SCENARIOS.length);assert.equal(campaign.productionActuationAllowed,false);
const redTeam=await runConstitutionalRedTeam({campaignId:"round9-contract-run"},{probe:async({scenario})=>({outcome:scenario.expected,passed:true,evidenceDigest:"2".repeat(64)})});assert.equal(redTeam.allPassed,true);assert.equal(redTeam.criticalFailureCount,0);assert.equal(redTeam.productionClosureAllowed,false);
const redEvidence=evaluateConstitutionalRedTeamEvidence({summary:redTeam,externalAttestationVerified:true,independentRunnerVerified:true,repeatRunVerified:true});assert.equal(redEvidence.verified,true);

const mobileCommunity=createRealWorldExecutionPlan({surface:"own-device",mobile:true,crossUserCommunityCompute:true});const mobileBlock=evaluateRealWorldExecutionAuthorization({plan:mobileCommunity,permissionScopeVerified:true,humanVetoAvailable:true});assert.equal(mobileBlock.authorized,false);assert.ok(mobileBlock.failed.includes("mobileCommunityComputeBlocked"));
const ownDevice=createRealWorldExecutionPlan({surface:"own-device",mobile:true,crossUserCommunityCompute:false});const ownDeviceAllow=evaluateRealWorldExecutionAuthorization({plan:ownDevice,permissionScopeVerified:true,humanVetoAvailable:true});assert.equal(ownDeviceAllow.authorized,true);
const robotics=createRealWorldExecutionPlan({surface:"robotics",physicalActuation:true});const roboticsAllow=evaluateRealWorldExecutionAuthorization({plan:robotics,constutionalTokenVerified:true,constitutionalTokenVerified:true,localAuthorityVerified:true,humanApproved:true,emergencyStopVerified:true,rollbackOrSafeStopVerified:true,permissionScopeVerified:true,humanVetoAvailable:true});assert.equal(roboticsAllow.authorized,true);assert.equal(roboticsAllow.productionActuationClaimAllowed,false);
const realWorld=getRealWorldExecutionStatus();assert.equal(realWorld.mobileCrossUserCommunityComputeAllowed,false);assert.equal(realWorld.physicalActuationRequiresHumanApproval,true);

const kernel=getLANERIQConstitutionalKernelStatus();assert.equal(kernel.version,"1.1.0");assert.equal(kernel.allRegisteredCapabilitiesCovered,true);assert.equal(kernel.allSystemSurfacesCovered,true);assert.equal(kernel.constitutionalExecutionTokensRequiredForHighRisk,true);assert.equal(kernel.mobileCrossUserCommunityComputeAllowed,false);
const control=getIntelligenceTransferControlPlaneStatus();assert.equal(control.horizontalCoverage.allRegisteredCapabilitiesCovered,true);assert.equal(control.horizontalCoverage.allSystemSurfacesCovered,true);assert.equal(control.executionGovernance.constitutionalRedTeamFactory,true);assert.equal(control.truthBoundary.codeTransferCompleteForCurrentRound,true);assert.equal(control.truthBoundary.productionMergeComplete,false);

console.log("LANERIQ Cognitive OS Round 9 / full remaining technology transfer contracts: PASS");
