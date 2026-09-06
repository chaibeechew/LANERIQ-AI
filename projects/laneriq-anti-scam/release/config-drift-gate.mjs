import crypto from 'node:crypto';

function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value,Object.keys(value||{}).sort())).digest('hex');}
export function evaluateConfigDrift({baseline,current,approvedChangeTicket=null}={}){
  if(!baseline||!current) return {ready:false,code:'CONFIG_SNAPSHOT_MISSING'};
  const baselineDigest=digest(baseline), currentDigest=digest(current);
  if(baselineDigest===currentDigest) return {ready:true,code:'NO_CONFIG_DRIFT',baselineDigest,currentDigest};
  const securityKeys=['vpnMode','threatProviderPins','retentionMs','regionPolicy','signingKeyId','evidenceKeyId','killSwitchDefault','releaseChannel'];
  const changed=securityKeys.filter(k=>JSON.stringify(baseline[k])!==JSON.stringify(current[k]));
  if(changed.length===0) return {ready:true,code:'NON_SECURITY_DRIFT_ONLY',changed,baselineDigest,currentDigest};
  if(!approvedChangeTicket||approvedChangeTicket.approved!==true||approvedChangeTicket.rollbackPlanVerified!==true||approvedChangeTicket.auditRecorded!==true) return {ready:false,code:'SECURITY_CONFIG_DRIFT_UNAPPROVED',changed,baselineDigest,currentDigest};
  return {ready:true,code:'SECURITY_CONFIG_DRIFT_APPROVED',changed,baselineDigest,currentDigest};
}
