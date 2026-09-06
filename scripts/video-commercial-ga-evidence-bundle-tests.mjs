import assert from 'node:assert/strict';
import {verifyVideoGAEvidenceReceipt,verifyVideoGAEvidenceBundle,buildVideoGAPromotionManifest} from '../lib/video/commercial-ga-evidence-bundle.js';

const SHA='a'.repeat(64);
const HASH='b'.repeat(64);
const releaseId='video-ga-2026-09-06';
const now=new Date().toISOString();
const types=['provider-execution','benchmark-observation','billing-ledger','reliability-run','production-release'];
const receipts=types.map((type,index)=>({
  type,
  evidenceId:`e-${index+1}`,
  releaseId,
  gitSha:SHA,
  artifactHash:HASH,
  issuer:`independent-verifier-${index+1}`,
  observedAt:now,
  independentlyVerified:true,
  providerSelfIssued:false,
}));

assert.equal(verifyVideoGAEvidenceReceipt(receipts[0],{releaseId,gitSha:SHA,maxAgeMs:60000}).ok,true);
assert.equal(verifyVideoGAEvidenceReceipt({...receipts[0],providerSelfIssued:true},{releaseId,gitSha:SHA}).ok,false);
assert.equal(verifyVideoGAEvidenceReceipt({...receipts[0],gitSha:'c'.repeat(64)},{releaseId,gitSha:SHA}).ok,false);

const bundle=verifyVideoGAEvidenceBundle({receipts,releaseId,gitSha:SHA,maxAgeMs:60000});
assert.equal(bundle.ok,true);
assert.equal(bundle.verifiedReceiptCount,5);
assert.equal(bundle.truth,'GA_EVIDENCE_BUNDLE_VERIFIED');

const missing=verifyVideoGAEvidenceBundle({receipts:receipts.slice(0,4),releaseId,gitSha:SHA,maxAgeMs:60000});
assert.equal(missing.ok,false);
assert.ok(missing.blockers.some(v=>v.includes('EVIDENCE_TYPE_MISSING:production-release')));

const duplicate=verifyVideoGAEvidenceBundle({receipts:[...receipts,receipts[0]],releaseId,gitSha:SHA,maxAgeMs:60000});
assert.equal(duplicate.ok,false);
assert.ok(duplicate.blockers.some(v=>v.includes('DUPLICATE_EVIDENCE_ID')));

const gateEvaluation={commercialGAReady:true,truth:'COMMERCIAL_GA_VERIFIED'};
const promotion=buildVideoGAPromotionManifest({releaseId,gitSha:SHA,gateEvaluation,evidenceBundle:bundle});
assert.equal(promotion.approved,true);
assert.equal(promotion.automaticMergeAllowed,false);
assert.equal(promotion.automaticProductionPromotionAllowed,false);
assert.equal(promotion.humanReleaseControllerRequired,true);

const fakePromotion=buildVideoGAPromotionManifest({releaseId,gitSha:SHA,gateEvaluation:{commercialGAReady:true,truth:'COMMERCIAL_GA_VERIFIED'},evidenceBundle:{...bundle,gitSha:'c'.repeat(64)}});
assert.equal(fakePromotion.approved,false);

console.log('AI Video Commercial GA evidence bundle contract: PASS');
