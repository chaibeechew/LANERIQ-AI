import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {buildImageHardenedProviderCandidates,validateImageObserverEvidence} from '../lib/ai/image-production-hardened-runtime.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

const route=fs.readFileSync('app/api/images/generate/route.js','utf8');
const readiness=fs.readFileSync('app/api/images/readiness/route.js','utf8');
const hardened=fs.readFileSync('lib/ai/image-production-hardened-runtime.js','utf8');

assert.match(route,/runImageProductionHardenedGeneration/);
assert.doesNotMatch(route,/generateExternalImages/);
assert.match(route,/REAL_OUTPUT_QUALITY_VERIFIED/);
assert.match(route,/IMAGE_LEGACY_MODEL_EVIDENCE_REQUIRED/);
assert.match(route,/AI image hardened generation failed - automatic refund/);
assert.match(route,/independently observed/);
assert.match(route,/byteHashBound:true/);

assert.match(readiness,/hardenedExecutionWired:true/);
assert.match(readiness,/failClosedQualityGate:true/);
assert.match(readiness,/independentObserverRequired:true/);
assert.match(readiness,/observerByteHashBinding:true/);
assert.match(readiness,/marketSalesReady:false/);
assert.match(readiness,/truth:"EVIDENCE_REQUIRED"/);

assert.match(hardened,/isApprovedImageOutputUrl/);
assert.match(hardened,/captureHttpsImage/);
assert.match(hardened,/createHmac\('sha256'/);
assert.match(hardened,/providerSelfReported:false/);
assert.match(hardened,/IMAGE_OBSERVER_CAPTURE_HASH_MISMATCH/);
assert.match(hardened,/REAL_OUTPUT_QUALITY_VERIFIED/);

const providers=buildImageHardenedProviderCandidates({
  generation:{provider:'image-provider',connected:true,configured:true,costClass:'zero',capabilities:['text-to-image']},
  safetyReady:true,providerQualityScore:93,
});
assert.equal(providers.length,1);
assert.equal(providers[0].safetyReady,true);
assert.deepEqual(providers[0].capabilities,['text-to-image']);
assert.equal(providers[0].verifiedOutputCount,0,'Configured code must not invent LIVE verified output evidence.');

const requestId='image:test:observer:1';
const secret='0123456789abcdef0123456789abcdef';
const image1=sha('captured-image-1');
const image2=sha('captured-image-2');
const output={images:[
  {id:'img-1',capturedSha256:image1},
  {id:'img-2',capturedSha256:image2},
]};
const perImage=[{id:'img-1',sha256:image1},{id:'img-2',sha256:image2}];
const artifactHash=digest(perImage);
const signals={composition:94,detail:95,lighting:93,promptAdherence:96,resolution:94};
const continuityObservations={};
const observationHash=digest({requestId,artifactHash,signals,continuityObservations,safetyPassed:true,provenanceVerified:true,outputValidated:true});
const signature=createHmac('sha256',secret).update(`${requestId}.${artifactHash}.${observationHash}`).digest('hex');
const config={observerKind:'laneriq-vision',observerId:'laneriq-vision-prod',observerSigningSecret:secret};
const evidence=validateImageObserverEvidence({
  requestId,output,config,
  data:{requestId,observerKind:'laneriq-vision',observedBy:'laneriq-vision-prod',safetyPassed:true,provenanceVerified:true,outputValidated:true,images:perImage,artifactHash,signals,continuityObservations,observationHash,signature},
});
assert.equal(evidence.evidence.signedEvidence,true);
assert.equal(evidence.evidence.providerSelfReported,false);
assert.equal(evidence.artifactHash,artifactHash);
assert.deepEqual(evidence.perImage,perImage);

assert.throws(()=>validateImageObserverEvidence({
  requestId,output,config,
  data:{requestId,observerKind:'laneriq-vision',observedBy:'laneriq-vision-prod',safetyPassed:true,provenanceVerified:true,outputValidated:true,images:[{id:'img-1',sha256:sha('tampered')},{id:'img-2',sha256:image2}],artifactHash,signals,continuityObservations,observationHash,signature},
}),error=>error?.code==='IMAGE_OBSERVER_CAPTURE_HASH_MISMATCH');

assert.throws(()=>validateImageObserverEvidence({
  requestId,output,config,
  data:{requestId,observerKind:'laneriq-vision',observedBy:'laneriq-vision-prod',safetyPassed:true,provenanceVerified:true,outputValidated:true,images:perImage,artifactHash,signals,continuityObservations,observationHash,signature:'0'.repeat(64)},
}),error=>error?.code==='IMAGE_OBSERVER_SIGNATURE_INVALID');

console.log('AI Image Production runtime wiring contract passed.');
