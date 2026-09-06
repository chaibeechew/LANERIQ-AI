import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { assertRuntimeUrlAllowed } from '../soolen/security-policy.js';
import { generateCreativeImage, getCreativeImageGenerationConfig } from './creative-image-generation-gateway.js';
import { IMAGE_GENERATION_LIMITS, ImageGenerationGatewayError, isApprovedImageOutputUrl } from './image-generation-gateway.js';
import { runCreativeMediaHardenedExecution } from './creative-media-intelligence-engine.js';

const MAX_IMAGE_BYTES=8*1024*1024;
const MAX_OBSERVER_RESPONSE_BYTES=128*1024;
const ALLOWED_MODES=new Set(['off','shadow','enforce']);
const TRUSTED_OBSERVERS=new Set(['laneriq-vision','device-vision','signed-external-vision']);
const MIME_EXT=new Set(['image/png','image/jpeg','image/webp']);

function clean(value,max=2000){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);}
function bool(value){return String(value||'').trim().toLowerCase()==='true';}
function boundedInt(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;}
function boundedNumber(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function stableObject(value){if(Array.isArray(value))return value.map(stableObject);if(value&&typeof value==='object'){return Object.keys(value).sort().reduce((out,key)=>{out[key]=stableObject(value[key]);return out;},{});}return value;}
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function safeSignals(value){const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};const out={};for(const [key,raw] of Object.entries(source)){const n=Number(raw);if(Number.isFinite(n))out[clean(key,80)]=Math.max(0,Math.min(100,n));}return out;}
function safeObservations(value){return safeSignals(value);}
function signaturePayload({requestId,artifactHash,observationHash,observerKind,observedBy}){return [clean(requestId,160),clean(artifactHash,64).toLowerCase(),clean(observationHash,64).toLowerCase(),clean(observerKind,80).toLowerCase(),clean(observedBy,160)].join('\n');}
function safeEqualHex(left,right){const a=Buffer.from(clean(left,128).toLowerCase(),'hex');const b=Buffer.from(clean(right,128).toLowerCase(),'hex');return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);}
function withTimeout(ms){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);return{signal:controller.signal,done:()=>clearTimeout(timer)};}
function imageSignatureValid(mime,buffer){if(!Buffer.isBuffer(buffer)||!buffer.length)return false;if(mime==='image/png')return buffer.length>=8&&buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a';if(mime==='image/jpeg')return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;if(mime==='image/webp')return buffer.length>=12&&buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';return false;}

function observerConfig(env=process.env){
  const modeRaw=clean(env.IMAGE_MARKET_HARDENING_MODE||'off',20).toLowerCase();
  const mode=ALLOWED_MODES.has(modeRaw)?modeRaw:'off';
  const endpoint=clean(env.IMAGE_QUALITY_OBSERVER_ENDPOINT,2000);
  const token=clean(env.IMAGE_QUALITY_OBSERVER_TOKEN,4000);
  const signingSecret=String(env.IMAGE_QUALITY_OBSERVER_SIGNING_SECRET||'');
  const observerKind=clean(env.IMAGE_QUALITY_OBSERVER_KIND||'laneriq-vision',80).toLowerCase();
  const observedBy=clean(env.IMAGE_QUALITY_OBSERVER_ID||'laneriq-image-quality-v1',160);
  const configured=Boolean(endpoint&&token&&signingSecret.length>=32&&TRUSTED_OBSERVERS.has(observerKind)&&observedBy);
  return{mode,endpoint,token,signingSecret,observerKind,observedBy,configured};
}

export function getImageMarketRuntimeReadiness(env=process.env){
  const provider=getCreativeImageGenerationConfig();
  const observer=observerConfig(env);
  const capabilities=new Set(provider.capabilities||[]);
  const verifiedOutputCount=Math.max(0,Number(env.IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT)||0);
  const productionEvidenceId=clean(env.IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID,160)||null;
  const safetyReady=bool(env.IMAGE_GENERATION_SAFETY_READY);
  const executionReady=observer.mode!=='off'&&provider.configured===true&&provider.blockedByCostPolicy!==true&&capabilities.has('text-to-image')&&safetyReady&&observer.configured;
  const sampleSize=Math.max(0,Number(env.IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE)||0);
  const successRate=boundedNumber(env.IMAGE_MARKET_RELIABILITY_SUCCESS_RATE,0,1,0);
  const p95Ms=Math.max(0,Number(env.IMAGE_MARKET_RELIABILITY_P95_MS)||0);
  const e2eEvidenceId=clean(env.IMAGE_MARKET_E2E_EVIDENCE_ID,180)||null;
  const releaseEvidenceHash=/^[a-f0-9]{64}$/i.test(clean(env.IMAGE_MARKET_RELEASE_EVIDENCE_SHA256,64))?clean(env.IMAGE_MARKET_RELEASE_EVIDENCE_SHA256,64).toLowerCase():null;
  const refundVerified=bool(env.IMAGE_MARKET_REFUND_EVIDENCE_VERIFIED);
  const marketApproved=bool(env.IMAGE_MARKET_RELEASE_APPROVED);
  const liveProviderVerified=verifiedOutputCount>0&&Boolean(productionEvidenceId);
  const reliabilityVerified=sampleSize>=100&&successRate>=0.98&&p95Ms>0&&p95Ms<=IMAGE_GENERATION_LIMITS.timeoutMs;
  const marketReady=observer.mode==='enforce'&&executionReady&&liveProviderVerified&&reliabilityVerified&&refundVerified&&Boolean(e2eEvidenceId&&releaseEvidenceHash)&&marketApproved;
  const blockers=[];
  if(observer.mode==='off')blockers.push('market-hardening-disabled');
  if(provider.configured!==true)blockers.push('provider-not-configured-or-cost-blocked');
  if(!capabilities.has('text-to-image'))blockers.push('text-to-image-capability-missing');
  if(!safetyReady)blockers.push('provider-safety-not-verified');
  if(!observer.configured)blockers.push('trusted-observer-not-configured');
  if(!liveProviderVerified)blockers.push('live-provider-output-proof-missing');
  if(!reliabilityVerified)blockers.push('commercial-reliability-proof-missing');
  if(!refundVerified)blockers.push('refund-evidence-missing');
  if(!e2eEvidenceId||!releaseEvidenceHash)blockers.push('production-e2e-evidence-missing');
  if(!marketApproved)blockers.push('market-release-approval-missing');
  return Object.freeze({
    mode:observer.mode,executionReady,marketReady,provider:provider.provider,providerConfigured:provider.configured===true,
    providerCostClass:provider.costClass,providerSafetyReady:safetyReady,capabilityReady:capabilities.has('text-to-image'),
    observerConfigured:observer.configured,observerKind:observer.observerKind,verifiedOutputCount,productionEvidenceId,
    reliability:Object.freeze({sampleSize,successRate,p95Ms,verified:reliabilityVerified}),refundVerified,e2eEvidenceId,releaseEvidenceHash,
    blockers:Object.freeze(blockers),
    rule:'Market Ready is fail-closed: enforce mode, live provider proof, trusted signed observation, >=100 reliability samples at >=98% success with bounded p95, refund proof and Production E2E evidence are all required.'
  });
}

async function decodeArtifact(item){
  const raw=String(item?.image||'');
  let mime='';let buffer=null;
  const data=raw.match(/^data:(image\/(?:png|jpeg|webp))(?:;charset=[^;,]+)?;base64,(.*)$/is);
  if(data){mime=data[1].toLowerCase();buffer=Buffer.from(data[2],'base64');}
  else if(/^https:\/\//i.test(raw)){
    if(!isApprovedImageOutputUrl(raw))throw new ImageGenerationGatewayError('Provider output host is not approved for market observation.','IMAGE_MARKET_OUTPUT_HOST_NOT_ALLOWED',502);
    const timer=withTimeout(20000);
    try{
      const response=await fetch(raw,{cache:'no-store',redirect:'error',signal:timer.signal,headers:{Accept:'image/png,image/jpeg,image/webp'}});
      if(!response.ok)throw new ImageGenerationGatewayError('Provider output could not be captured for quality observation.','IMAGE_MARKET_OUTPUT_FETCH_FAILED',502);
      mime=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
      const length=Number(response.headers.get('content-length')||0);if(length>MAX_IMAGE_BYTES)throw new ImageGenerationGatewayError('Provider output exceeds the market quality byte limit.','IMAGE_MARKET_OUTPUT_TOO_LARGE',413);
      buffer=Buffer.from(await response.arrayBuffer());
    }catch(error){if(error?.name==='AbortError')throw new ImageGenerationGatewayError('Provider output capture timed out.','IMAGE_MARKET_OUTPUT_FETCH_TIMEOUT',504);throw error;}finally{timer.done();}
  }else throw new ImageGenerationGatewayError('Provider output format is unsupported for market observation.','IMAGE_MARKET_OUTPUT_FORMAT_INVALID',502);
  if(!MIME_EXT.has(mime)||!buffer?.length||buffer.length>MAX_IMAGE_BYTES||!imageSignatureValid(mime,buffer))throw new ImageGenerationGatewayError('Provider output bytes failed market validation.','IMAGE_MARKET_OUTPUT_BYTES_INVALID',502);
  const artifactHash=sha256(buffer);
  const providerHash=clean(item?.providerEvidence?.artifactHash,64).toLowerCase();
  if(providerHash&&providerHash!==artifactHash)throw new ImageGenerationGatewayError('Provider evidence hash does not match captured output.','IMAGE_MARKET_PROVIDER_HASH_MISMATCH',502);
  return{mime,buffer,artifactHash,width:Number(item?.width)||null,height:Number(item?.height)||null};
}

function verifyObserverSignature({config,requestId,artifactHash,observationHash,observerKind,observedBy,signature}){
  if(!config.signingSecret||config.signingSecret.length<32)return false;
  const expected=createHmac('sha256',config.signingSecret).update(signaturePayload({requestId,artifactHash,observationHash,observerKind,observedBy})).digest('hex');
  return safeEqualHex(expected,signature);
}

async function observeImage({task,input,requestId,item,observer}){
  const artifact=await decodeArtifact(item);
  let endpoint;
  try{endpoint=assertRuntimeUrlAllowed(observer.endpoint);}catch(error){throw new ImageGenerationGatewayError('The configured image quality observer is not allowed.','IMAGE_MARKET_OBSERVER_ENDPOINT_INVALID',error?.status||500);}
  const timeout=withTimeout(30000);let response;
  const artifactForObserver={image:item.image,sha256:artifact.artifactHash,bytes:artifact.buffer.length,mime:artifact.mime,width:artifact.width,height:artifact.height};
  try{
    response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${observer.token}`,'Idempotency-Key':requestId},body:JSON.stringify({schemaVersion:1,requestId,task,input:{prompt:clean(input.prompt,4000),negativePrompt:clean(input.negativePrompt,2000)||null,style:clean(input.style,100)||null,palette:clean(input.palette,100)||null},artifact:artifactForObserver,requirements:{safety:true,provenance:true,qualitySignals:true,continuity:true}}),cache:'no-store',redirect:'error',signal:timeout.signal});
  }catch(error){if(error?.name==='AbortError')throw new ImageGenerationGatewayError('Image quality observer timed out.','IMAGE_MARKET_OBSERVER_TIMEOUT',504);throw new ImageGenerationGatewayError('Image quality observer is unavailable.','IMAGE_MARKET_OBSERVER_UNREACHABLE',503);}finally{timeout.done();}
  const raw=await response.text();if(Buffer.byteLength(raw,'utf8')>MAX_OBSERVER_RESPONSE_BYTES)throw new ImageGenerationGatewayError('Image quality observer response is too large.','IMAGE_MARKET_OBSERVER_RESPONSE_TOO_LARGE',502);
  let data={};try{data=raw?JSON.parse(raw):{};}catch{}
  if(!response.ok)throw new ImageGenerationGatewayError('Image quality observer rejected the candidate.',clean(data?.code,100)||'IMAGE_MARKET_OBSERVER_REJECTED',response.status>=400&&response.status<600?response.status:502);
  const observerKind=clean(data?.observerKind||observer.observerKind,80).toLowerCase();
  const observedBy=clean(data?.observedBy||observer.observedBy,160);
  if(observerKind!==observer.observerKind||observedBy!==observer.observedBy)throw new ImageGenerationGatewayError('Image quality observer identity did not match configured trust policy.','IMAGE_MARKET_OBSERVER_IDENTITY_MISMATCH',502);
  const signals=safeSignals(data?.signals);const continuityObservations=safeObservations(data?.continuityObservations);
  const observationRecord=stableObject({observerKind,observedBy,signals,continuityObservations,safetyPassed:data?.safetyPassed===true,provenanceVerified:data?.provenanceVerified===true,artifactHash:artifact.artifactHash});
  const observationHash=sha256(Buffer.from(JSON.stringify(observationRecord)));
  const signatureVerified=verifyObserverSignature({config:observer,requestId,artifactHash:artifact.artifactHash,observationHash,observerKind,observedBy,signature:data?.signature});
  return{
    signals,
    artifact:{valid:true,width:artifact.width,height:artifact.height,bytes:artifact.buffer.length,sha256:artifact.artifactHash},
    evidence:{observerKind,observedBy,artifactHash:artifact.artifactHash,observationHash,signedEvidence:signatureVerified,signatureVerified,providerSelfReported:false,safetyPassed:data?.safetyPassed===true,provenanceVerified:data?.provenanceVerified===true,outputValidated:true},
    continuityObservations,
  };
}

function providerDescriptor(config,env=process.env){
  return{id:config.provider,connected:config.configured===true,available:true,safetyReady:bool(env.IMAGE_GENERATION_SAFETY_READY),costClass:config.costClass,freeQuotaRemaining:Math.max(0,Number(env.IMAGE_GENERATION_FREE_QUOTA_REMAINING)||0),capabilities:config.capabilities,qualityScore:boundedNumber(env.IMAGE_GENERATION_PROVIDER_QUALITY_SCORE,0,100,0),latencyMs:Math.max(0,Number(env.IMAGE_GENERATION_PROVIDER_P95_MS)||0),verifiedOutputCount:Math.max(0,Number(env.IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT)||0),productionEvidenceId:clean(env.IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID,160)||null};
}

async function runOneImage({prompt,style,palette,requestId,env=process.env}){
  const config=getCreativeImageGenerationConfig();const observer=observerConfig(env);const provider=providerDescriptor(config,env);
  const freeLike=config.costClass==='zero'||config.costClass==='free';const repairSpendAllowed=bool(env.IMAGE_MARKET_ALLOW_REPAIR_SPEND);
  const maxRounds=freeLike||repairSpendAllowed?boundedInt(env.IMAGE_MARKET_MAX_ROUNDS,1,3,2):1;
  const input={prompt:clean(prompt,4000),style:clean(style,100)||null,palette:clean(palette,100)||null,count:1};
  const result=await runCreativeMediaHardenedExecution({
    task:'image.generate',input,requestId,providers:[provider],costMode:freeLike?'zero':'balanced',premiumAllowed:bool(env.IMAGE_MARKET_PREMIUM_ALLOWED),allowMultiCandidateSpend:false,maxCandidates:1,maxRounds,
    executeCandidate:async ({input:candidateInput,requestId:candidateRequestId})=>generateCreativeImage({task:'image.generate',input:{...candidateInput,count:1},requestId:candidateRequestId}),
    observeCandidate:async ({input:candidateInput,requestId:candidateRequestId,output})=>{
      const item=output?.images?.[0];if(!output?.generated||!item)throw new ImageGenerationGatewayError('Image provider returned no candidate for market quality judging.','IMAGE_MARKET_CANDIDATE_MISSING',502);
      return observeImage({task:'image.generate',input:candidateInput,requestId:candidateRequestId,item,observer});
    },
  });
  return result;
}

export async function runMarketHardenedImageGeneration({prompt,style,palette,count=1,requestId,env=process.env}={}){
  const readiness=getImageMarketRuntimeReadiness(env);
  if(!readiness.executionReady)return{configured:false,generated:false,hardened:true,truth:'EVIDENCE_REQUIRED',code:'IMAGE_MARKET_RUNTIME_NOT_READY',readiness,images:[]};
  const total=boundedInt(count,1,IMAGE_GENERATION_LIMITS.maxCount,1);const images=[];const results=[];
  for(let index=0;index<total;index+=1){
    const childRequestId=`${clean(requestId,140)}:o${index+1}`.slice(0,160);
    const result=await runOneImage({prompt,style,palette,requestId:childRequestId,env});results.push(result);
    if(!result?.ok||result?.status!=='completed'||!result?.winner?.output?.images?.[0])throw new ImageGenerationGatewayError('No image candidate passed the commercial quality gate.','IMAGE_MARKET_QUALITY_GATE_FAILED',422);
    const item=result.winner.output.images[0];images.push({...item,qualityScore:result.winner.judgement?.score??null,qualityDecision:result.winner.judgement?.decision||null,truth:result.truth,providerId:result.winner.providerId});
  }
  const scores=images.map(item=>Number(item.qualityScore)).filter(Number.isFinite);const qualityScore=scores.length?Number((scores.reduce((sum,n)=>sum+n,0)/scores.length).toFixed(2)):null;
  const evidenceDigest=sha256(Buffer.from(JSON.stringify(results.map(result=>({truth:result.truth,providerId:result.winner?.providerId,score:result.winner?.judgement?.score,artifactHash:result.winner?.judgement?.observation?.artifactHash,observationHash:result.winner?.judgement?.observation?.observationHash})))));
  return{configured:true,generated:true,hardened:true,truth:'REAL_OUTPUT_QUALITY_VERIFIED',images,quality:{score:qualityScore,decision:'accept',gatePassed:true},evidenceDigest,readiness};
}
