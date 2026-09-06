import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceFreshnessReplayGuard } from '../evidence-freshness-replay-guard.mjs';
import { evaluatePrivacyEnvelope, redactToAllowed } from '../privacy-budget.mjs';
import { evaluateChaosCampaign } from '../chaos-resilience-evaluator.mjs';
import { evaluateKeyRotation } from '../key-rotation-quorum.mjs';
import { buildIncidentPlan, verifyRemediationResult } from '../incident-remediation-graph.mjs';
import { evaluateThreatIntelQuorum } from '../threat-intel-quorum.mjs';

test('evidence freshness guard rejects replay and stale evidence',()=>{
  const now=Date.now(); const g=new EvidenceFreshnessReplayGuard();
  const e={issuer:'provider-a',subject:'sha256',nonce:'n1',artifactSha256:'a'.repeat(64),issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString()};
  assert.equal(g.verify(e,now).ok,true); assert.equal(g.verify(e,now).code,'EVIDENCE_REPLAY');
  const stale={...e,nonce:'n2',issuedAt:new Date(now-60*60_000).toISOString(),expiresAt:new Date(now+60000).toISOString()};
  assert.equal(g.verify(stale,now).code,'EVIDENCE_STALE');
});

test('privacy budget blocks private telemetry and redacts explicitly',()=>{
  assert.equal(evaluatePrivacyEnvelope({event:'heartbeat',phone:'123'}).code,'FORBIDDEN_FIELD');
  assert.deepEqual(redactToAllowed({event:'heartbeat',phone:'123',risk:'low'},['event','risk','phone']),{event:'heartbeat',risk:'low'});
});

test('chaos campaign requires all failure classes and safe bounded recovery',()=>{
  const ids=['networkDrop','processKill','reboot','clockSkew','providerTimeout','databaseUnavailable','regionLoss','rollback'];
  const cases=ids.map(id=>({id,executed:true,passed:true,recoveryMs:100,maxRecoveryMs:1000,dataLoss:false,securityBoundaryPreserved:true,falseReadyClaim:false}));
  assert.equal(evaluateChaosCampaign(cases).ready,true);
  assert.equal(evaluateChaosCampaign(cases.slice(1)).ready,false);
});

test('key rotation requires quorum, revocation and rollback escrow',()=>{
  const ok=evaluateKeyRotation({activeKeyCount:2,oldKeyRevoked:true,newKeyVerified:true,rollbackKeyEscrowed:true,approverQuorumMet:true,rotationAuditRecorded:true,providerPinsUpdated:true});
  assert.equal(ok.ready,true);
  assert.equal(evaluateKeyRotation({...ok,activeKeyCount:1}).ready,false);
});

test('incident remediation is reversible and non-destructive by default',()=>{
  const plan=buildIncidentPlan([{id:'1',kind:'remote-control',confidence:.99}]);
  assert.equal(plan.automaticDestructiveRemediation,false); assert.equal(plan.userApprovalRequired,true);
  assert.equal(verifyRemediationResult({userApproved:true,beforeEvidenceHash:'a',afterEvidenceHash:'b',rollbackAvailable:true,dataDeletionPerformed:false,protectionClaimUpgraded:false}).ok,true);
});

test('threat intel requires independent fresh signed sources and rejects conflict',()=>{
  const a={sourceId:'a',signatureVerified:true,artifactBound:true,fresh:true,verdict:'MALICIOUS'};
  const b={sourceId:'b',signatureVerified:true,artifactBound:true,fresh:true,verdict:'MALICIOUS'};
  assert.equal(evaluateThreatIntelQuorum([a,b]).ready,true);
  assert.equal(evaluateThreatIntelQuorum([a,{...b,verdict:'CLEAN'}]).code,'SOURCE_CONFLICT');
});
