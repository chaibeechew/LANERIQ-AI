export function evaluateKeyRotation(input={}) {
  const blockers=[];
  if(input.activeKeyCount!==2) blockers.push('DUAL_KEY_WINDOW_REQUIRED');
  if(input.oldKeyRevoked!==true) blockers.push('OLD_KEY_NOT_REVOKED');
  if(input.newKeyVerified!==true) blockers.push('NEW_KEY_NOT_VERIFIED');
  if(input.rollbackKeyEscrowed!==true) blockers.push('ROLLBACK_KEY_ESCROW_MISSING');
  if(input.approverQuorumMet!==true) blockers.push('APPROVER_QUORUM_NOT_MET');
  if(input.rotationAuditRecorded!==true) blockers.push('ROTATION_AUDIT_MISSING');
  if(input.providerPinsUpdated!==true) blockers.push('PROVIDER_PINS_STALE');
  return {ready:blockers.length===0, blockers};
}
