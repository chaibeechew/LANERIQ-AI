import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getProductIntelligenceCoverage, createCapabilityCognitiveRun, createSystemSurfaceCognitiveRun, LANERIQ_SYSTEM_SURFACES } from "../lib/soolen/product-intelligence-coverage.js";
import { issueConstitutionalExecutionToken, verifyConstitutionalExecutionToken, authorizeConstitutionalExecution } from "../lib/soolen/constitutional-execution-token.js";
import { createConstitutionalRedTeamCampaign, evaluateConstitutionalRedTeamEvidence, CONSTITUTIONAL_RED_TEAM_SCENARIOS } from "../lib/soolen/constitutional-red-team-factory.js";
import { createProtocolConformanceReceipt, createRemoteAgentDelegationGrant, evaluateRemoteAgentTrust, summarizeProtocolReadiness } from "../lib/soolen/protocol-conformance-runtime.js";
import { createIndependentBenchmarkAttestation, evaluateExternalBenchmarkClosure } from "../lib/soolen/independent-intelligence-attestation.js";
import { getHumanCivilizationLaw } from "../lib/soolen/human-civilization-law.js";

const LAW=getHumanCivilizationLaw();
const digest=(value)=>crypto.createHash("sha256").update(String(value)).digest("hex");

const coverage=getProductIntelligenceCoverage();
assert.equal(coverage.allRegisteredCapabilitiesCovered,true,"every registered LANERIQ capability must map to Cognitive coverage");
assert.equal(coverage.allSystemSurfacesCovered,true,"every declared system surface must map to Cognitive coverage");
assert.equal(coverage.humanCivilizationLawDigest,LAW.lawDigest);
for(const row of coverage.registered){assert.equal(row.covered,true);assert.equal(row.constitutionalLawDigest,LAW.lawDigest);}
for(const surface of LANERIQ_SYSTEM_SURFACES){const run=createSystemSurfaceCognitiveRun(surface,{goal:`contract ${surface}`});assert.equal(run.constitution.lawDigest,LAW.lawDigest);}
const appRun=createCapabilityCognitiveRun("app-website-builder",{goal:"build safely"});assert.equal(appRun.constitution.applies,true);

const secret="x".repeat(64);const now=Date.now();
assert.throws(()=>issueConstitutionalExecutionToken({scope:"production",action:"deploy",principal:"human-owner",risk:"critical",production:true,constitutionalAlignmentAccepted:true,nowMs:now},secret),/HUMAN_APPROVAL_REQUIRED/);
const issued=issueConstitutionalExecutionToken({scope:"production",action:"deploy",principal:"human-owner",risk:"critical",production:true,constitutionalAlignmentAccepted:true,humanApproved:true,authorityGrantDigest:digest("grant"),nowMs:now,ttlSeconds:9999},secret);
assert.ok(issued.payload.expiresAt-issued.payload.issuedAt<=300000,"critical constitutional tokens must be short lived");
const verified=verifyConstitutionalExecutionToken(issued.token,secret,{scope:"production",action:"deploy",principal:"human-owner",authorityGrantDigest:digest("grant"),nowMs:now+1000});assert.equal(verified.valid,true);
assert.equal(authorizeConstitutionalExecution({verification:verified,toolGuardrailPassed:true,permissionScopeVerified:true,humanVetoAvailable:true}).allowed,true);
assert.equal(authorizeConstitutionalExecution({verification:verified,toolGuardrailPassed:true,permissionScopeVerified:true,humanVetoAvailable:false}).allowed,false);

const campaign=createConstitutionalRedTeamCampaign({campaignId:"round9"});assert.equal(campaign.scenarioCount,12);assert.equal(CONSTITUTIONAL_RED_TEAM_SCENARIOS.length,12);
const fakeSummary={allPassed:true,scenarioCount:12,criticalFailureCount:0,lawDigest:LAW.lawDigest};
assert.equal(evaluateConstitutionalRedTeamEvidence({summary:fakeSummary,externalAttestationVerified:false,independentRunnerVerified:true,repeatRunVerified:true}).verified,false,"internal red-team success may not become external evidence");

const evidenceDigest=digest("protocol-evidence");
const mcp=createProtocolConformanceReceipt({protocol:"MCP",observedVersion:"2026-07-28",suiteName:"external-mcp-suite",testsTotal:100,testsPassed:100,externalRunner:true,independentVerifier:true,signatureVerified:true,evidenceArtifactDigest:evidenceDigest});
const a2a=createProtocolConformanceReceipt({protocol:"A2A",observedVersion:"1.0",suiteName:"external-a2a-tck",testsTotal:100,testsPassed:100,externalRunner:true,independentVerifier:true,signatureVerified:true,evidenceArtifactDigest:evidenceDigest});
assert.equal(mcp.mayClaimExternalConformance,true);assert.equal(a2a.mayClaimExternalConformance,true);
const grant=createRemoteAgentDelegationGrant({agentCardDigest:digest("agent-card"),principalGrantDigest:digest("principal-grant"),scopes:["research"],nowMs:now});
const trust=evaluateRemoteAgentTrust({grant,requestedScopes:["research"],conformanceReceipt:a2a,agentCardSignatureVerified:true,principalGrantVerified:true,remoteAgentIdentityVerified:true,humanVetoAvailable:true,nowMs:now+1000});assert.equal(trust.trusted,true);
assert.equal(evaluateRemoteAgentTrust({grant,requestedScopes:["research","deploy"],conformanceReceipt:a2a,agentCardSignatureVerified:true,principalGrantVerified:true,remoteAgentIdentityVerified:true,humanVetoAvailable:true,nowMs:now+1000}).trusted,false,"remote agents may not exceed delegated scopes");
assert.equal(summarizeProtocolReadiness({mcpReceipt:mcp,a2aReceipt:a2a,remoteAgentTrust:trust}).productionInteroperabilityClaimAllowed,true);

const attestation=createIndependentBenchmarkAttestation({campaignDigest:digest("campaign"),evidenceArtifactDigest:digest("artifact"),providerClasses:["provider-a","provider-b"],attestorClass:"independent-attestor",judgeClass:"independent-judge",realMultiProviderObserved:true,blindEvaluationVerified:true,adversarialCasesIncluded:true,signatureVerified:true,externalArtifactVerified:true,lawDigest:LAW.lawDigest});
assert.equal(attestation.verified,true);assert.equal(attestation.mayPromoteToProductionByItself,false);
const closure=evaluateExternalBenchmarkClosure({attestation,benchmarkPassed:true,passRate:.95,minimumPassRate:.9,averageScore:92,minimumAverageScore:85,distinctExternalProviders:2,repeatabilityVerified:true});assert.equal(closure.closed,true);assert.equal(closure.productionClaimAllowed,false,"benchmark closure must still defer to Production Release Control");

console.log("LANERIQ Cognitive OS Round 9 full-platform transfer contracts: PASS");
