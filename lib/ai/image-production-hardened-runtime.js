import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { assertRuntimeUrlAllowed } from '../soolen/security-policy.js';
import { generateCreativeImage,getCreativeImageGenerationConfig } from './creative-image-generation-gateway.js';
import { ImageGenerationGatewayError,isApprovedImageOutputUrl } from './image-generation-gateway.js';
import { runCreativeMediaHardenedExecution } from './creative-media-intelligence-engine.js';
import { IMAGE_QUALITY_DIMENSIONS } from './creative-media-quality-judge.js';

const REQUEST_ID=/^[A-Za-z0-9._:-]{1,160}$/;
const SHA256=/^[a-f0-9]{64}$/;
const OBSERVER_KINDS=new Set(['laneriq-vision','device-vision','signed-external-vision']);
const IMAGE_MIME=new Set(['image/png','image/jpeg','image/webp']);
const MAX_IMAGE_BYTES=8*1024*1024;
const MAX_OBSERVER_RESPONSE_BYTES=128*1024;
const MAX_OBSERVER_TIMEOUT_MS=30000;
const MIN_OBSERVER_TIMEOUT_MS=3000;

function clean(value,max=2000){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);}
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function safeDigest(value){const raw=clean(value,64).toLowerCase();return SHA256.test(raw)?raw:null;}
function safeJson(raw){try{return raw?JSON.parse(raw):{};}catch{return{};}}
function withTimeout(ms){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);return{signal:controller.signal,done:()=>clearTimeout(timer)};}
function safeNumericMap(value,allowed=null,maxKeys=40){const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};const out={};for(const key of Object.keys(source).sort()){if(allowed&&!allowed.has(key))continue;const n=Number(source[key]);if(!Number.isFinite(n))continue;out[key]=Math.max(0,Math.min(100,n));if(Object.keys(out).length>=maxKeys)break;}return out;}
function signatureMatches(actual,expected){const a=Buffer.from(clean(actual,128).toLowerCase(),'utf8');const b=Buffer.from(expected,'utf8');return a.length===b.length&&timingSafeEqual(a,b);}
function signatureLooksValid(mime,buffer){if(!Buffer.isBuffer(buffer)||!buffer.length)return false;if(mime==='image/png')return buffer.length>=8&&buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a';if(mime==='image/jpeg')return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;if(mime==='image/webp')return buffer.length>=12&&buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';return false;}

export function getImageProductionHardenedConfig(env=process.env){
  const generation=getCreativeImageGenerationConfig();
  const observerEndpoint=clean(env.IMAGE_QUALITY_OBSERVER_ENDPOINT,2000);
  const observerKind=clean(env.IMAGE_QUALITY_OBSERVER_KIND||'laneriq-vision',80).toLowerCase();
  const observerId=clean(env.IMAGE_QUALITY_OBSERVER_ID,160);
  const observerSigningSecret=String(env.IMAGE_QUALITY_OBSERVER_SIGNING_SECRET||'').trim();
  const observerToken=String(env.IMAGE_QUALITY_OBSERVER_TOKEN||'').trim();
  const observerConnected=Boolean(observerEndpoint&&OBSERVER_KINDS.has(observerKind)&&observerId&&observerSigningSecret.length>=32);
  return{
    generation,
    observerEndpoint:observerEndpoint||null,
    observerKind,
    observerId:observerId||null,
    observerToken:observerToken||null,
    observerSigningSecret:observerSigningSecret||null,
    observerConnected,
    safetyReady:String(env.IMAGE_GENERATION_SAFETY_READY||'').trim().toLowerCase()==='true',
    providerQualityScore:clamp(env.IMAGE_GENERATION_PROVIDER_QUALITY_SCORE,0,100,0),
    maxRounds:Math.floor(clamp(env.IMAGE_HARDENED_MAX_ROUNDS,1,3,2)),
    observerTimeoutMs:Math.floor(clamp(env.IMAGE_QUALITY_OBSERVER_TIMEOUT_MS,MIN_OBSERVER_TIMEOUT_MS,MAX_OBSERVER_TIMEOUT_MS,20000)),
  };
}

export function buildImageHardenedProviderCandidates(config=getImageProductionHardenedConfig()){
  const generation=config.generation||{};
  return[{
    id:clean(generation.provider||'provider-neutral',100),
    label:clean(generation.provider||'provider-neutral',120),
    connected:generation.connected===true,
    available:generation.configured===true,
    safetyReady:config.safetyReady===true,
    costClass:clean(generation.costClass||'metered',40).toLowerCase(),
    capabilities:Array.isArray(generation.capabilities)?generation.capabilities:[],
    qualityScore:clamp(config.providerQualityScore,0,100,0),
    verifiedOutputCount:0,
    productionEvidenceId:null,
  }];
}

async function captureHttpsImage(raw){
  if(!isApprovedImageOutputUrl(raw))throw new ImageGenerationGatewayError('Provider output host is not approved for hardened capture.','IMAGE_HARDENED_CAPTURE_HOST_NOT_ALLOWED',502);
  const timeout=withTimeout(20000);
  try{
    const response=await fetch(String(raw),{cache:'no-store',redirect:'error',signal:timeout.signal,headers:{Accept:'image/png,image/jpeg,image/webp'}});
    if(!response.ok)throw new ImageGenerationGatewayError('Provider image could not be captured for hardened validation.','IMAGE_HARDENED_CAPTURE_REJECTED',502);
    const mime=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();if(!IMAGE_MIME.has(mime))throw new ImageGenerationGatewayError('Provider image type is not supported by hardened validation.','IMAGE_HARDENED_CAPTURE_TYPE_INVALID',502);
    const declared=Number(response.headers.get('content-length')||0);if(declared>MAX_IMAGE_BYTES)throw new ImageGenerationGatewayError('Provider image exceeds hardened capture limit.','IMAGE_HARDENED_CAPTURE_TOO_LARGE',413);
    const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>MAX_IMAGE_BYTES||!signatureLooksValid(mime,buffer))throw new ImageGenerationGatewayError('Provider image bytes failed hardened validation.','IMAGE_HARDENED_CAPTURE_BYTES_INVALID',502);
    return{mime,buffer,sha256:createHash('sha256').update(buffer).digest('hex'),dataUri:`data:${mime};base64,${buffer.toString('base64')}`};
  }catch(error){
    if(error?.name==='AbortError')throw new ImageGenerationGatewayError('Hardened provider image capture timed out.','IMAGE_HARDENED_CAPTURE_TIMEOUT',504);
    if(error instanceof ImageGenerationGatewayError)throw error;
    throw new ImageGenerationGatewayError('Hardened provider image capture failed.','IMAGE_HARDENED_CAPTURE_FAILED',502);
  }finally{timeout.done();}
}

async function captureCandidateOutput(output={}){
  const images=Array.isArray(output.images)?output.images:[];if(!images.length)throw new ImageGenerationGatewayError('The provider returned no image candidate for hardened capture.','IMAGE_HARDENED_OUTPUT_MISSING',502);
  const captured=[];
  for(let index=0;index<images.length;index++){
    const item=images[index];const providerUrl=String(item?.image||'');if(!/^https:\/\//i.test(providerUrl))throw new ImageGenerationGatewayError('Hardened production image validation requires HTTPS provider output.','IMAGE_HARDENED_HTTPS_OUTPUT_REQUIRED',502);
    const bytes=await captureHttpsImage(providerUrl);captured.push({...item,id:clean(item?.id,120)||`candidate-${index+1}`,providerUrl,capturedDataUri:bytes.dataUri,capturedSha256:bytes.sha256,capturedBytes:bytes.buffer.length,capturedMime:bytes.mime});
  }
  return{...output,images:captured};
}

function normalizeObserverImages(output={}){
  const images=Array.isArray(output.images)?output.images:[];
  if(!images.length)throw new ImageGenerationGatewayError('The provider returned no image candidate for hardened observation.','IMAGE_HARDENED_OUTPUT_MISSING',502);
  return images.map((item,index)=>({id:clean(item?.id,120)||`candidate-${index+1}`,url:String(item?.providerUrl||''),sha256:safeDigest(item?.capturedSha256),width:Number(item?.width)||null,height:Number(item?.height)||null}));
}

export function validateImageObserverEvidence({data,requestId,output,config}={}){
  const body=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
  const stable=clean(requestId,160);
  if(!REQUEST_ID.test(stable)||clean(body.requestId,160)!==stable)throw new ImageGenerationGatewayError('Image observer evidence request binding failed.','IMAGE_OBSERVER_REQUEST_BINDING_FAILED',502);
  if(clean(body.observerKind,80).toLowerCase()!==config.observerKind||clean(body.observedBy,160)!==config.observerId)throw new ImageGenerationGatewayError('Image observer identity is not trusted.','IMAGE_OBSERVER_IDENTITY_FAILED',502);
  if(body.safetyPassed!==true||body.provenanceVerified!==true||body.outputValidated!==true)throw new ImageGenerationGatewayError('Image observer safety, provenance or output validation failed.','IMAGE_OBSERVER_REQUIRED_EVIDENCE_FAILED',422);

  const sourceImages=Array.isArray(output?.images)?output.images:[];
  const evidenceImages=Array.isArray(body.images)?body.images:[];
  if(!sourceImages.length||evidenceImages.length!==sourceImages.length)throw new ImageGenerationGatewayError('Image observer evidence does not cover every generated image.','IMAGE_OBSERVER_IMAGE_COVERAGE_FAILED',502);
  const perImage=sourceImages.map((item,index)=>{
    const evidence=evidenceImages[index]||{};const id=clean(item?.id,120)||`candidate-${index+1}`;
    if(clean(evidence.id,120)!==id)throw new ImageGenerationGatewayError('Image observer evidence order or id binding failed.','IMAGE_OBSERVER_IMAGE_BINDING_FAILED',502);
    const sha256=safeDigest(evidence.sha256||evidence.artifactHash);const capturedSha256=safeDigest(item?.capturedSha256);
    if(!sha256||!capturedSha256)throw new ImageGenerationGatewayError('Image observer artifact hash is missing.','IMAGE_OBSERVER_ARTIFACT_HASH_MISSING',502);
    if(sha256!==capturedSha256)throw new ImageGenerationGatewayError('Independent observer saw different bytes than the hardened server capture.','IMAGE_OBSERVER_CAPTURE_HASH_MISMATCH',502);
    return{id,sha256};
  });
  const artifactHash=digest(perImage);
  if(safeDigest(body.artifactHash)!==artifactHash)throw new ImageGenerationGatewayError('Image observer aggregate artifact hash does not match per-image evidence.','IMAGE_OBSERVER_ARTIFACT_HASH_MISMATCH',502);

  const allowedSignals=new Set(IMAGE_QUALITY_DIMENSIONS);
  const signals=safeNumericMap(body.signals,allowedSignals,IMAGE_QUALITY_DIMENSIONS.length);
  const continuityObservations=safeNumericMap(body.continuityObservations,null,40);
  const observationMaterial={requestId:stable,artifactHash,signals,continuityObservations,safetyPassed:true,provenanceVerified:true,outputValidated:true};
  const observationHash=digest(observationMaterial);
  if(safeDigest(body.observationHash)!==observationHash)throw new ImageGenerationGatewayError('Image observer measurement digest is invalid.','IMAGE_OBSERVER_MEASUREMENT_HASH_MISMATCH',502);
  const expectedSignature=createHmac('sha256',config.observerSigningSecret).update(`${stable}.${artifactHash}.${observationHash}`).digest('hex');
  if(!signatureMatches(body.signature,expectedSignature))throw new ImageGenerationGatewayError('Image observer signature verification failed.','IMAGE_OBSERVER_SIGNATURE_INVALID',502);

  return{
    signals,continuityObservations,perImage,artifactHash,observationHash,
    evidence:{observerKind:config.observerKind,observedBy:config.observerId,artifactHash,observationHash,signedEvidence:true,providerSelfReported:false,safetyPassed:true,provenanceVerified:true,outputValidated:true},
  };
}

async function observeImageCandidate({task,input,requestId,providerId,output,config}){
  if(!config.observerConnected)throw new ImageGenerationGatewayError('Trusted image quality observer is not configured.','IMAGE_HARDENED_OBSERVER_REQUIRED',503);
  let endpoint;try{endpoint=assertRuntimeUrlAllowed(config.observerEndpoint);}catch(error){throw new ImageGenerationGatewayError('Configured image observer endpoint is not allowed.','IMAGE_OBSERVER_ENDPOINT_INVALID',error?.status||500);}
  const images=normalizeObserverImages(output);const headers={'Content-Type':'application/json',Accept:'application/json'};if(config.observerToken)headers.Authorization=`Bearer ${config.observerToken}`;
  const timeout=withTimeout(config.observerTimeoutMs);
  let response,raw;
  try{
    response=await fetch(endpoint,{method:'POST',headers,cache:'no-store',redirect:'error',signal:timeout.signal,body:JSON.stringify({schemaVersion:1,requestId,task,providerId,prompt:clean(input?.prompt,4000),style:clean(input?.style,100)||null,palette:clean(input?.palette,100)||null,images})});
    const length=Number(response.headers.get('content-length')||0);if(length>MAX_OBSERVER_RESPONSE_BYTES)throw new ImageGenerationGatewayError('Image observer response is too large.','IMAGE_OBSERVER_RESPONSE_TOO_LARGE',502);
    raw=await response.text();if(Buffer.byteLength(raw,'utf8')>MAX_OBSERVER_RESPONSE_BYTES)throw new ImageGenerationGatewayError('Image observer response is too large.','IMAGE_OBSERVER_RESPONSE_TOO_LARGE',502);
  }catch(error){
    if(error?.name==='AbortError')throw new ImageGenerationGatewayError('Image quality observer timed out.','IMAGE_OBSERVER_TIMEOUT',504);
    if(error instanceof ImageGenerationGatewayError)throw error;
    throw new ImageGenerationGatewayError('Image quality observer is unavailable.','IMAGE_OBSERVER_UNREACHABLE',503);
  }finally{timeout.done();}
  const data=safeJson(raw);if(!response.ok)throw new ImageGenerationGatewayError('Image observer rejected the candidate.',clean(data?.code,100)||'IMAGE_OBSERVER_REJECTED',response.status>=400&&response.status<600?response.status:502);
  return validateImageObserverEvidence({data,requestId,output,config});
}

export async function runImageProductionHardenedGeneration({prompt,style,palette,count=1,requestId}={}){
  const stable=clean(requestId,160);if(!REQUEST_ID.test(stable))throw new ImageGenerationGatewayError('A stable image request id is required.','IMAGE_HARDENED_REQUEST_ID_INVALID',400);
  const config=getImageProductionHardenedConfig();
  if(!config.generation?.configured)throw new ImageGenerationGatewayError('No approved image generation provider is configured.','IMAGE_HARDENED_PROVIDER_REQUIRED',503);
  if(!config.safetyReady)throw new ImageGenerationGatewayError('The image provider has not passed the production safety-ready gate.','IMAGE_HARDENED_PROVIDER_SAFETY_REQUIRED',503);
  if(!config.observerConnected)throw new ImageGenerationGatewayError('Trusted independent image observation is required before provider output can be released.','IMAGE_HARDENED_OBSERVER_REQUIRED',503);
  const providers=buildImageHardenedProviderCandidates(config);
  const input={prompt:clean(prompt,4000),style:clean(style,100)||null,palette:clean(palette,100)||null,count:Math.max(1,Math.min(4,Math.floor(Number(count)||1)))};
  const result=await runCreativeMediaHardenedExecution({
    task:'image.generate',input,requestId:stable,providers,costMode:config.generation.costMode||'zero',premiumAllowed:false,allowMultiCandidateSpend:false,maxCandidates:1,maxRounds:config.maxRounds,
    executeCandidate:async({task,input:workingInput,requestId:candidateRequestId,providerId})=>{if(providerId!==providers[0].id)throw new ImageGenerationGatewayError('Unexpected image provider candidate.','IMAGE_HARDENED_PROVIDER_MISMATCH',502);const generated=await generateCreativeImage({task,input:workingInput,requestId:candidateRequestId});if(!generated?.generated)throw new ImageGenerationGatewayError('Image provider did not generate a candidate.','IMAGE_HARDENED_PROVIDER_NO_OUTPUT',502);return captureCandidateOutput(generated);},
    observeCandidate:async({task,input:workingInput,requestId:candidateRequestId,providerId,output})=>{const observed=await observeImageCandidate({task,input:workingInput,requestId:candidateRequestId,providerId,output,config});output.hardenedEvidence={perImage:observed.perImage,artifactHash:observed.artifactHash,observationHash:observed.observationHash};const first=Array.isArray(output.images)?output.images[0]:null;return{signals:observed.signals,artifact:{valid:true,width:Number(first?.width)||null,height:Number(first?.height)||null,bytes:Number(first?.capturedBytes)||null,sha256:observed.artifactHash},evidence:observed.evidence,continuityObservations:observed.continuityObservations};},
  });
  if(!result?.ok||result.truth!=='REAL_OUTPUT_QUALITY_VERIFIED'||!result.winner?.output?.generated)throw new ImageGenerationGatewayError('No provider image passed the hardened production quality gate.','IMAGE_HARDENED_QUALITY_GATE_FAILED',422);
  const evidence=result.winner.output.hardenedEvidence||{};const perImage=Array.isArray(evidence.perImage)?evidence.perImage:[];const outputImages=Array.isArray(result.winner.output.images)?result.winner.output.images:[];
  if(!outputImages.length||perImage.length!==outputImages.length)throw new ImageGenerationGatewayError('Accepted image output is missing complete hardened evidence.','IMAGE_HARDENED_EVIDENCE_INCOMPLETE',502);
  const hashes=new Map(perImage.map(row=>[row.id,row.sha256]));
  const images=outputImages.map((item,index)=>{const id=clean(item?.id,120)||`candidate-${index+1}`;const expectedSha256=hashes.get(id);if(!expectedSha256||expectedSha256!==safeDigest(item?.capturedSha256))throw new ImageGenerationGatewayError('Accepted image output is not hash-bound to captured observer evidence.','IMAGE_HARDENED_EVIDENCE_BINDING_FAILED',502);return{id,image:item.capturedDataUri,width:item?.width||null,height:item?.height||null,expectedSha256};});
  return{generated:true,provider:result.winner.providerId,images,truth:result.truth,qualityScore:Number(result.winner.judgement?.score||0),qualityDecision:result.winner.judgement?.decision||'accept',evidenceDigest:evidence.observationHash||null,artifactDigest:evidence.artifactHash||null,rounds:result.rounds?.length||1};
}
