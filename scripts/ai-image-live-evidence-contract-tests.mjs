import assert from 'node:assert/strict';
import {getImageMarketRuntimeReadiness,signImageMarketEvidenceBundle} from '../lib/ai/image-market-runtime.js';

const keys=[
  'SOOLEN_COST_MODE','IMAGE_GENERATION_PROVIDER','IMAGE_GENERATION_ENDPOINT','IMAGE_GENERATION_COST_CLASS','IMAGE_GENERATION_CAPABILITIES','IMAGE_GENERATION_SAFETY_READY',
  'IMAGE_QUALITY_OBSERVER_ENDPOINT','IMAGE_QUALITY_OBSERVER_KIND','IMAGE_QUALITY_OBSERVER_ID','IMAGE_QUALITY_OBSERVER_SIGNING_SECRET','IMAGE_MARKET_EVIDENCE_BUNDLE_B64','IMAGE_MARKET_EVIDENCE_SIGNING_SECRET','IMAGE_MARKET_EVIDENCE_SIGNATURE',
  'VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA'
];
const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
function restore(){for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}

const evidenceSecret='market-evidence-signing-secret-0123456789abcdef';
const observerSecret='observer-signing-secret-0123456789abcdef';
const productionSha='d'.repeat(40);
const bundle={
  schemaVersion:1,
  evidence:{
    liveProviderVerified:true,
    verifiedOutputCount:24,
    qualityScore:93.4,
    productionEvidenceId:'image-live-output-proof-20260906',
    evidenceSha256:'a'.repeat(64),
    safetyPassed:true,
    provenanceVerified:true,
    outputValidated:true,
    observerSignedEvidence:true,
    artifactHashBound:true,
    providerSelfReported:false,
  },
  reliability:{
    sampleSize:120,
    successRate:.9917,
    p95LatencyMs:21000,
    refundFailureRate:0,
    evidenceSha256:'b'.repeat(64),
    refundVerified:true,
    idempotencyVerified:true,
    rateLimitVerified:true,
    abusePressureVerified:true,
    alternateProviderAvailable:false,
    providerFailoverVerified:false,
  },
  release:{
    authenticatedProductionE2E:true,
    e2eEvidenceId:'image-prod-e2e-20260906',
    releaseEvidenceSha256:'c'.repeat(64),
    browserVerified:true,
    mobileVerified:true,
    abuseSuitePassed:true,
    monitoringReady:true,
    releaseApproved:true,
    mainSha:productionSha,
    productionSha,
  },
};

try{
  process.env.SOOLEN_COST_MODE='zero';
  process.env.IMAGE_GENERATION_PROVIDER='contract-image-provider';
  process.env.IMAGE_GENERATION_ENDPOINT='https://images.example.com/generate';
  process.env.IMAGE_GENERATION_COST_CLASS='zero';
  process.env.IMAGE_GENERATION_CAPABILITIES='text-to-image';
  process.env.IMAGE_GENERATION_SAFETY_READY='true';
  process.env.IMAGE_QUALITY_OBSERVER_ENDPOINT='https://observer.example.com/judge';
  process.env.IMAGE_QUALITY_OBSERVER_KIND='laneriq-vision';
  process.env.IMAGE_QUALITY_OBSERVER_ID='laneriq-image-quality-v1';
  process.env.IMAGE_QUALITY_OBSERVER_SIGNING_SECRET=observerSecret;
  process.env.IMAGE_MARKET_EVIDENCE_SIGNING_SECRET=evidenceSecret;
  process.env.VERCEL_ENV='production';
  process.env.VERCEL_GIT_COMMIT_REF='main';
  process.env.VERCEL_GIT_COMMIT_SHA=productionSha;

  const signed=signImageMarketEvidenceBundle(bundle,evidenceSecret);
  process.env.IMAGE_MARKET_EVIDENCE_BUNDLE_B64=signed.encoded;
  process.env.IMAGE_MARKET_EVIDENCE_SIGNATURE=signed.signature;

  let readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.evidenceBundleVerified,true);
  assert.equal(readiness.marketReady,true);
  assert.equal(readiness.passedLayers,4);
  assert.equal(readiness.release.productionTarget,true);
  assert.equal(readiness.release.productionSha,productionSha);
  assert.equal(readiness.evidence.providerSelfReported,false);

  const tampered=JSON.parse(Buffer.from(signed.encoded,'base64').toString('utf8'));
  tampered.evidence.verifiedOutputCount=999;
  process.env.IMAGE_MARKET_EVIDENCE_BUNDLE_B64=Buffer.from(JSON.stringify(tampered),'utf8').toString('base64');
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.evidenceBundleVerified,false,'tampered evidence must fail signature verification');
  assert.equal(readiness.marketReady,false);
  assert.ok(readiness.blockers.includes('evidence-signature-invalid'));

  process.env.IMAGE_MARKET_EVIDENCE_BUNDLE_B64=signed.encoded;
  process.env.VERCEL_ENV='preview';
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false,'Preview cannot close Layer 4 even with a valid signed bundle');
  assert.equal(readiness.layers[3].passed,false);

  process.env.VERCEL_ENV='production';
  process.env.VERCEL_GIT_COMMIT_SHA='e'.repeat(40);
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false,'Production runtime SHA drift must fail closed');
  assert.equal(readiness.layers[3].checks.exactSha,false);

  process.env.VERCEL_GIT_COMMIT_SHA=productionSha;
  process.env.IMAGE_QUALITY_OBSERVER_SIGNING_SECRET='short';
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false,'trusted observer must remain configured at runtime');
  assert.ok(readiness.blockers.includes('trusted-independent-observer-not-connected'));

  console.log('AI Image signed live evidence bundle contracts passed.');
} finally { restore(); }
