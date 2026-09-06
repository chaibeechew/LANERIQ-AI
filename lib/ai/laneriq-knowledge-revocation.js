function clean(value,max=300){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
const REVOCATION_REASONS=new Set(["security-regression","critical-incident","wrong-exact-sha","production-probe-failure","provider-policy-change","stale-external-fact","benchmark-regression","manual-revocation"]);

export function evaluateKnowledgeRevocation(item={}, {reason="",evidencePassed=false,exactShaMismatch=false,critical=false}={}){
  const normalized=clean(reason,64).toLowerCase();
  const validReason=REVOCATION_REASONS.has(normalized);
  const active=["validated","production_rule"].includes(clean(item?.status,32));
  const hardTrigger=exactShaMismatch===true||critical===true||normalized==="security-regression"||normalized==="production-probe-failure";
  const allowed=active&&validReason&&(hardTrigger||evidencePassed===true);
  return{contract:"laneriq-knowledge-revocation-decision-v1",itemId:clean(item?.id,40),allowed,reason:validReason?normalized:"invalid-reason",hardTrigger,historyPreserved:true,deleteHistory:false,decision:allowed?"revoke":"keep"};
}

export function revokeKnowledgeItem(item={},options={}){
  const decision=evaluateKnowledgeRevocation(item,options);
  if(!decision.allowed)return{...item,revocation:decision};
  return{...item,status:"revoked",revokedReason:decision.reason,revocation:decision,historyPreserved:true,autoPromotable:false};
}

export function quarantineKnowledgeItem(item={},reason="unverified-conflict"){
  return{...item,status:"quarantined",quarantineReason:clean(reason,120)||"unverified-conflict",historyPreserved:true,autoPromotable:false};
}

export function revocationReasonIds(){return [...REVOCATION_REASONS];}
