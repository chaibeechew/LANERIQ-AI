const freeze=v=>Object.freeze(v);
const clean=v=>String(v||'').trim();
const sha256=v=>/^[a-f0-9]{64}$/i.test(clean(v));
const iso=v=>Number.isFinite(Date.parse(clean(v)));

export const VIDEO_GA_RUNTIME_RECEIPT_KINDS=freeze([
  'provider-execution','benchmark-sample','billing-event','reliability-event','production-probe'
]);

export function verifyTrustedIssuer(issuer={},registry=[]){
  const id=clean(issuer.id),keyId=clean(issuer.keyId),fingerprint=clean(issuer.fingerprint);
  const trusted=(Array.isArray(registry)?registry:[]).find(row=>clean(row.id)===id&&clean(row.keyId)===keyId&&clean(row.fingerprint)===fingerprint);
  const blockers=[];
  if(!id||!keyId||!sha256(fingerprint)) blockers.push('ISSUER_IDENTITY_INVALID');
  if(!trusted) blockers.push('ISSUER_NOT_TRUSTED');
  if(trusted?.revoked===true) blockers.push('ISSUER_REVOKED');
  if(trusted?.productionEligible!==true) blockers.push('ISSUER_NOT_PRODUCTION_ELIGIBLE');
  return freeze({ok:blockers.length===0,id:id||null,keyId:keyId||null,blockers:freeze(blockers)});
}

export function verifyRuntimeEvidenceReceipt(receipt={},context={}){
  const blockers=[];
  const kind=clean(receipt.kind),releaseId=clean(receipt.releaseId),gitSha=clean(receipt.gitSha),artifactHash=clean(receipt.artifactHash),nonce=clean(receipt.nonce),observedAt=clean(receipt.observedAt);
  if(!VIDEO_GA_RUNTIME_RECEIPT_KINDS.includes(kind)) blockers.push('RUNTIME_RECEIPT_KIND_INVALID');
  if(!releaseId) blockers.push('RELEASE_ID_REQUIRED');
  if(!sha256(gitSha)) blockers.push('GIT_SHA_INVALID');
  if(!sha256(artifactHash)) blockers.push('ARTIFACT_HASH_INVALID');
  if(!nonce||nonce.length<16) blockers.push('NONCE_INVALID');
  if(!iso(observedAt)) blockers.push('OBSERVED_AT_INVALID');
  if(receipt.signatureVerified!==true) blockers.push('SIGNATURE_VERIFICATION_REQUIRED');
  if(receipt.selfReported===true) blockers.push('SELF_REPORTED_RECEIPT_REJECTED');
  const issuer=verifyTrustedIssuer(receipt.issuer,context.trustedIssuers);
  blockers.push(...issuer.blockers);
  if(context.releaseId&&releaseId!==clean(context.releaseId)) blockers.push('RELEASE_ID_MISMATCH');
  if(context.gitSha&&gitSha!==clean(context.gitSha)) blockers.push('GIT_SHA_MISMATCH');
  if(context.maxAgeMs&&iso(observedAt)&&Date.now()-Date.parse(observedAt)>Number(context.maxAgeMs)) blockers.push('RUNTIME_RECEIPT_STALE');
  if(context.usedNonces instanceof Set&&context.usedNonces.has(nonce)) blockers.push('NONCE_REPLAY_DETECTED');
  if(blockers.length===0&&context.usedNonces instanceof Set) context.usedNonces.add(nonce);
  return freeze({ok:blockers.length===0,kind:kind||null,releaseId:releaseId||null,gitSha:gitSha||null,artifactHash:artifactHash||null,nonce:nonce||null,issuer:issuer.id,blockers:freeze(blockers)});
}

export function aggregateRuntimeEvidence({receipts=[],releaseId='',gitSha='',trustedIssuers=[],maxAgeMs=7*24*60*60*1000}={}){
  const usedNonces=new Set();
  const verified=(Array.isArray(receipts)?receipts:[]).map(r=>verifyRuntimeEvidenceReceipt(r,{releaseId,gitSha,trustedIssuers,maxAgeMs,usedNonces}));
  const required=VIDEO_GA_RUNTIME_RECEIPT_KINDS;
  const blockers=verified.flatMap(r=>r.blockers.map(b=>`${r.kind||'unknown'}:${b}`));
  for(const kind of required) if(!verified.some(r=>r.ok&&r.kind===kind)) blockers.push(`RUNTIME_EVIDENCE_KIND_MISSING:${kind}`);
  return freeze({ok:blockers.length===0,releaseId:clean(releaseId)||null,gitSha:clean(gitSha)||null,verifiedCount:verified.filter(r=>r.ok).length,totalCount:verified.length,blockers:freeze(blockers),truth:blockers.length===0?'RUNTIME_EVIDENCE_VERIFIED':'RUNTIME_EVIDENCE_REQUIRED'});
}
