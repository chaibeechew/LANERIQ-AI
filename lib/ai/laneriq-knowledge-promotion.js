import {evidenceKinds} from "./laneriq-experience-ledger.js";
import {evaluateKnowledgeSources} from "./laneriq-knowledge-source-trust.js";

function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function hasPassed(candidate,kind,predicate=()=>true){return (Array.isArray(candidate?.evidence)?candidate.evidence:[]).some(item=>item?.kind===kind&&item?.passed===true&&predicate(item));}
function sourceType(kind){return({contract:"deterministic_contract",runtime:"runtime_probe",physical_device:"physical_device",benchmark:"benchmark",incident:"incident",production_exact_sha:"production_exact_sha",manual_review:"user_feedback",official_docs:"official_docs",model_suggestion:"model_suggestion",community_report:"community_report",user_feedback:"user_feedback",untrusted:"unknown"})[kind]||"unknown";}
function sourceTrust(candidate){return evaluateKnowledgeSources((Array.isArray(candidate?.evidence)?candidate.evidence:[]).map(item=>({type:sourceType(item?.kind),passed:item?.passed===true,independent:item?.independent===true,ref:item?.ref||""})));}

export function evaluateKnowledgePromotion(candidate={}, {target="validated",reviewerApproved=false}={}){
  const kinds=evidenceKinds(candidate),risk=clean(candidate?.risk,16).toLowerCase()||"normal",trust=sourceTrust(candidate);
  const blockers=[];
  if(candidate?.contract!=="laneriq-experience-candidate-v1")blockers.push("invalid-candidate-contract");
  if(candidate?.status!=="candidate")blockers.push("candidate-status-required");
  if(candidate?.containsRawSecrets!==false)blockers.push("secret-safety-unverified");
  if(candidate?.containsPrivateUserContent!==false)blockers.push("private-user-content-safety-unverified");
  if(candidate?.containsDirectPii!==false)blockers.push("direct-pii-safety-unverified");
  if(candidate?.autoPromotable!==false)blockers.push("auto-promotion-forbidden");
  if(!hasPassed(candidate,"contract"))blockers.push("deterministic-contract-evidence-required");
  if(kinds.length<2)blockers.push("evidence-diversity-required");
  if(!trust.validatedSupport)blockers.push("high-trust-source-required");
  if(risk==="critical"&&!hasPassed(candidate,"manual_review"))blockers.push("critical-risk-manual-review-evidence-required");

  if(target==="production_rule"){
    if(reviewerApproved!==true)blockers.push("human-review-approval-required");
    if(!hasPassed(candidate,"production_exact_sha",item=>item.exactSha===true&&item.independent===true))blockers.push("independent-exact-sha-production-evidence-required");
    const runtimeEvidence=hasPassed(candidate,"runtime",item=>item.independent===true)||hasPassed(candidate,"physical_device",item=>item.independent===true)||hasPassed(candidate,"benchmark",item=>item.independent===true);
    if(!runtimeEvidence)blockers.push("independent-runtime-benchmark-or-device-evidence-required");
    if(!trust.productionSupport)blockers.push("two-high-trust-production-sources-required");
  }

  const allowed=blockers.length===0;
  return{contract:"laneriq-knowledge-promotion-decision-v2",candidateId:clean(candidate?.id,40),target:target==="production_rule"?"production_rule":"validated",allowed,blockers,evidenceKinds:kinds,sourceTrust:{highTrustCount:trust.highTrustCount,productionSupportCount:trust.productionSupportCount,modelOnly:trust.modelOnly},reviewerApproved:reviewerApproved===true,decision:allowed?"promotable":"blocked"};
}

export function promoteKnowledgeCandidate(candidate={},options={}){
  const decision=evaluateKnowledgePromotion(candidate,options);
  if(!decision.allowed)return{...candidate,status:"candidate",promotion:decision};
  return{...candidate,status:decision.target==="production_rule"?"production_rule":"validated",promotion:decision,autoPromotable:false};
}
