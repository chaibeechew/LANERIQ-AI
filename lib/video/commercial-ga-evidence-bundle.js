const freeze=value=>Object.freeze(value);
const clean=value=>String(value||'').trim();
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const iso=value=>Number.isFinite(Date.parse(clean(value)));

export const VIDEO_GA_EVIDENCE_TYPES=freeze([
  'provider-execution','benchmark-observation','billing-ledger','reliability-run','production-release'
]);

export function verifyVideoGAEvidenceReceipt(receipt={},context={}){
  const blockers=[];
  const type=clean(receipt.type);
  const releaseId=clean(receipt.releaseId);
  const gitSha=clean(receipt.gitSha);
  const artifactHash=clean(receipt.artifactHash);
  const evidenceId=clean(receipt.evidenceId);
  const issuer=clean(receipt.issuer);
  const observedAt=clean(receipt.observedAt);
  if(!VIDEO_GA_EVIDENCE_TYPES.includes(type)) blockers.push('EVIDENCE_TYPE_INVALID');
  if(!evidenceId) blockers.push('EVIDENCE_ID_REQUIRED');
  if(!releaseId) blockers.push('RELEASE_ID_REQUIRED');
  if(!sha256(gitSha)) blockers.push('GIT_SHA_INVALID');
  if(!sha256(artifactHash)) blockers.push('ARTIFACT_HASH_INVALID');
  if(!issuer) blockers.push('ISSUER_REQUIRED');
  if(receipt.providerSelfIssued===true) blockers.push('PROVIDER_SELF_ISSUED_EVIDENCE_REJECTED');
  if(receipt.independentlyVerified!==true) blockers.push('INDEPENDENT_VERIFICATION_REQUIRED');
  if(!iso(observedAt)) blockers.push('OBSERVED_AT_INVALID');
  if(context.releaseId&&releaseId!==clean(context.releaseId)) blockers.push('RELEASE_ID_MISMATCH');
  if(context.gitSha&&gitSha!==clean(context.gitSha)) blockers.push('GIT_SHA_MISMATCH');
  if(context.maxAgeMs&&iso(observedAt)&&Date.now()-Date.parse(observedAt)>Number(context.maxAgeMs)) blockers.push('EVIDENCE_STALE');
  return freeze({ok:blockers.length===0,type:type||null,evidenceId:evidenceId||null,releaseId:releaseId||null,gitSha:gitSha||null,blockers:freeze(blockers)});
}

export function verifyVideoGAEvidenceBundle({receipts=[],releaseId='',gitSha='',requiredTypes=VIDEO_GA_EVIDENCE_TYPES,maxAgeMs=30*24*60*60*1000}={}){
  const blockers=[];
  if(!releaseId) blockers.push('BUNDLE_RELEASE_ID_REQUIRED');
  if(!sha256(gitSha)) blockers.push('BUNDLE_GIT_SHA_INVALID');
  const list=Array.isArray(receipts)?receipts:[];
  const verified=list.map(receipt=>verifyVideoGAEvidenceReceipt(receipt,{releaseId,gitSha,maxAgeMs}));
  const ids=new Set();
  for(const item of verified){
    if(item.evidenceId&&ids.has(item.evidenceId)) blockers.push(`DUPLICATE_EVIDENCE_ID:${item.evidenceId}`);
    if(item.evidenceId) ids.add(item.evidenceId);
    for(const blocker of item.blockers) blockers.push(`${item.evidenceId||'unknown'}:${blocker}`);
  }
  for(const type of requiredTypes){
    if(!verified.some(item=>item.ok&&item.type===type)) blockers.push(`EVIDENCE_TYPE_MISSING:${type}`);
  }
  return freeze({ok:blockers.length===0,releaseId:releaseId||null,gitSha:gitSha||null,receiptCount:list.length,verifiedReceiptCount:verified.filter(v=>v.ok).length,blockers:freeze(blockers),truth:blockers.length===0?'GA_EVIDENCE_BUNDLE_VERIFIED':'GA_EVIDENCE_BUNDLE_REQUIRED'});
}

export function buildVideoGAPromotionManifest({releaseId='',gitSha='',gateEvaluation,evidenceBundle}={}){
  const blockers=[];
  if(!gateEvaluation?.commercialGAReady||gateEvaluation?.truth!=='COMMERCIAL_GA_VERIFIED') blockers.push('FIVE_GATE_EVALUATION_NOT_VERIFIED');
  if(!evidenceBundle?.ok||evidenceBundle?.truth!=='GA_EVIDENCE_BUNDLE_VERIFIED') blockers.push('EVIDENCE_BUNDLE_NOT_VERIFIED');
  if(clean(releaseId)!==clean(evidenceBundle?.releaseId)) blockers.push('PROMOTION_RELEASE_ID_MISMATCH');
  if(clean(gitSha)!==clean(evidenceBundle?.gitSha)) blockers.push('PROMOTION_GIT_SHA_MISMATCH');
  const approved=blockers.length===0;
  return freeze({approved,releaseId:clean(releaseId)||null,gitSha:clean(gitSha)||null,status:approved?'COMMERCIAL_GA_PROMOTION_ELIGIBLE':'PROMOTION_BLOCKED',blockers:freeze(blockers),automaticMergeAllowed:false,automaticProductionPromotionAllowed:false,humanReleaseControllerRequired:true});
}
