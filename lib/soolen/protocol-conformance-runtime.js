import crypto from "node:crypto";
import { MCP_TARGET_SPEC, A2A_TARGET_VERSION } from "./agentic-protocol-bridge.js";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const PROTOCOL_CONFORMANCE_RUNTIME_VERSION="1.0.0";
const LAW=getHumanCivilizationLaw();
function text(value,max=500){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function isDigest(value){return /^[a-f0-9]{64}$/.test(String(value||""));}

export function createProtocolConformanceReceipt(input={}){
  const protocol=text(input.protocol,20).toUpperCase();
  if(!["MCP","A2A"].includes(protocol))throw new Error("LANERIQ_PROTOCOL_CONFORMANCE_PROTOCOL_INVALID");
  const targetVersion=protocol==="MCP"?MCP_TARGET_SPEC:A2A_TARGET_VERSION;
  const total=Math.max(0,Math.floor(Number(input.testsTotal)||0));
  const passed=Math.max(0,Math.floor(Number(input.testsPassed)||0));
  const suite=text(input.suiteName,200);
  if(!suite||!total)throw new Error("LANERIQ_PROTOCOL_CONFORMANCE_SUITE_AND_TESTS_REQUIRED");
  const core={protocol,targetVersion,observedVersion:text(input.observedVersion,80),suiteName:suite,testsTotal:total,testsPassed:passed,externalRunner:input.externalRunner===true,independentVerifier:input.independentVerifier===true,signatureVerified:input.signatureVerified===true,runnerClass:text(input.runnerClass,120),evidenceArtifactDigest:text(input.evidenceArtifactDigest,64),lawDigest:LAW.lawDigest};
  const versionMatches=core.observedVersion===targetVersion;
  const allPassed=passed===total;
  const artifactValid=isDigest(core.evidenceArtifactDigest);
  const externallyVerified=versionMatches&&allPassed&&artifactValid&&core.externalRunner&&core.independentVerifier&&core.signatureVerified;
  return Object.freeze({...core,versionMatches,allPassed,artifactValid,externallyVerified,mayClaimExternalConformance:externallyVerified,receiptDigest:digest(core),productionCompatibilityClaimAllowed:externallyVerified});
}

export function createRemoteAgentDelegationGrant(input={}){
  const agentCardDigest=text(input.agentCardDigest,64);const principalGrantDigest=text(input.principalGrantDigest,64);
  if(!isDigest(agentCardDigest)||!isDigest(principalGrantDigest))throw new Error("LANERIQ_REMOTE_AGENT_DELEGATION_DIGEST_REQUIRED");
  const scopes=[...new Set((Array.isArray(input.scopes)?input.scopes:[]).map(v=>text(v,120)).filter(Boolean))].slice(0,30);
  if(!scopes.length)throw new Error("LANERIQ_REMOTE_AGENT_DELEGATION_SCOPE_REQUIRED");
  const now=Number.isFinite(Number(input.nowMs))?Number(input.nowMs):Date.now();
  const ttl=Math.min(3600,Math.max(60,Number(input.ttlSeconds)||900));
  const grant={agentCardDigest,principalGrantDigest,scopes:Object.freeze(scopes),issuedAt:now,expiresAt:now+ttl*1000,delegationDepth:Math.max(0,Math.min(1,Number(input.delegationDepth)||0)),nonTransferable:true,maySubdelegate:false,revocationRequired:true,lawDigest:LAW.lawDigest,authorityMayNotExceedPrincipalGrant:true};
  return Object.freeze({...grant,grantDigest:digest(grant)});
}

export function evaluateRemoteAgentTrust(input={}){
  const grant=input.grant||{};const now=Number.isFinite(Number(input.nowMs))?Number(input.nowMs):Date.now();
  const requested=[...new Set((Array.isArray(input.requestedScopes)?input.requestedScopes:[]).map(v=>text(v,120)).filter(Boolean))];
  const granted=new Set(Array.isArray(grant.scopes)?grant.scopes:[]);
  const conformance=input.conformanceReceipt||{};
  const checks=Object.freeze({
    agentCardSignatureVerified:input.agentCardSignatureVerified===true,
    protocolConformanceVerified:conformance.externallyVerified===true,
    protocolLawCurrent:conformance.lawDigest===LAW.lawDigest,
    grantLawCurrent:grant.lawDigest===LAW.lawDigest,
    grantNotExpired:Number(grant.expiresAt)>now,
    grantNotRevoked:input.revoked!==true,
    grantNonTransferable:grant.nonTransferable===true&&grant.maySubdelegate===false,
    requestedScopesWithinGrant:requested.every(scope=>granted.has(scope)),
    principalGrantVerified:input.principalGrantVerified===true,
    remoteAgentIdentityVerified:input.remoteAgentIdentityVerified===true,
    humanApprovalForExternalSideEffects:input.externalSideEffects!==true||input.humanApproved===true,
    humanVetoAvailable:input.humanVetoAvailable===true,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return Object.freeze({trusted:failed.length===0,checks,failed:Object.freeze(failed),action:failed.length?"BLOCK_REMOTE_AGENT":"ALLOW_SCOPED_DELEGATION",lawDigest:LAW.lawDigest,authorityExpanded:false,transitiveDelegationAllowed:false});
}

export function summarizeProtocolReadiness(input={}){
  const mcp=input.mcpReceipt;const a2a=input.a2aReceipt;
  return Object.freeze({version:PROTOCOL_CONFORMANCE_RUNTIME_VERSION,mcpExternalConformanceVerified:mcp?.protocol==="MCP"&&mcp?.externallyVerified===true,a2aExternalTckVerified:a2a?.protocol==="A2A"&&a2a?.externallyVerified===true,remoteAgentTrustVerified:input.remoteAgentTrust?.trusted===true,lawDigest:LAW.lawDigest,productionInteroperabilityClaimAllowed:Boolean(mcp?.externallyVerified&&a2a?.externallyVerified&&input.remoteAgentTrust?.trusted)});
}
