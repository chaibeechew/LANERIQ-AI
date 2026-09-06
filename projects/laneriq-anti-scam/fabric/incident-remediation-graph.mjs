export function buildIncidentPlan(signals=[]){
  const normalized=(signals||[]).filter(Boolean).map(s=>({id:String(s.id||''),kind:String(s.kind||''),confidence:Number(s.confidence||0),userImpact:String(s.userImpact||'unknown')}));
  const high=normalized.filter(s=>s.confidence>=0.9);
  const actions=[];
  if(high.some(s=>s.kind==='credential-theft')) actions.push('REQUIRE_CREDENTIAL_RESET');
  if(high.some(s=>s.kind==='malware')) actions.push('ISOLATE_SENSITIVE_FLOWS');
  if(high.some(s=>s.kind==='remote-control')) actions.push('BLOCK_LANERIQ_SENSITIVE_ACTIONS');
  if(high.some(s=>s.kind==='guardian-tamper')) actions.push('ENTER_EMERGENCY_MODE');
  if(high.some(s=>s.kind==='web-phishing')) actions.push('BLOCK_KNOWN_BAD_DESTINATION');
  return {signalCount:normalized.length,highConfidenceCount:high.length,actions:[...new Set(actions)],automaticDestructiveRemediation:false,userApprovalRequired:true};
}

export function verifyRemediationResult(result={}){
  const blockers=[];
  if(result.userApproved!==true) blockers.push('USER_APPROVAL_REQUIRED');
  if(result.beforeEvidenceHash===result.afterEvidenceHash) blockers.push('NO_STATE_CHANGE_EVIDENCE');
  if(result.rollbackAvailable!==true) blockers.push('ROLLBACK_UNAVAILABLE');
  if(result.dataDeletionPerformed===true&&result.explicitDeletionConsent!==true) blockers.push('DELETION_CONSENT_MISSING');
  if(result.protectionClaimUpgraded===true&&result.externalEvidenceVerified!==true) blockers.push('UNSUPPORTED_PROTECTION_UPGRADE');
  return {ok:blockers.length===0,blockers};
}
