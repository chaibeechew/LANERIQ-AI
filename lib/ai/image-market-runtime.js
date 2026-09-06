import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {getImageProductionHardenedConfig} from './image-production-hardened-runtime.js';
import {assessAiImageMarketReadiness} from './image-market-readiness.js';

const MAX_BUNDLE_BYTES=96*1024;
const HEX64=/^[a-f0-9]{64}$/i;
const HEX40=/^[a-f0-9]{40}$/i;

const clean=(value,max=4000)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
const bool=value=>value===true;

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{out[key]=stable(value[key]);return out;},{});
  return value;
}
function canonical(value){return JSON.stringify(stable(value));}
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function safeHexEqual(left,right){
  const a=Buffer.from(clean(left,128).toLowerCase(),'utf8');
  const b=Buffer.from(clean(right,128).toLowerCase(),'utf8');
  return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
}
function decodeBundle(raw){
  if(!raw)return null;
  let buffer;
  try{buffer=Buffer.from(String(raw),'base64');}catch{return null;}
  if(!buffer.length||buffer.length>MAX_BUNDLE_BYTES)return null;
  try{
    const parsed=JSON.parse(buffer.toString('utf8'));
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;
  }catch{return null;}
}

export function signImageMarketEvidenceBundle(bundle,secret){
  const material=canonical(bundle);
  const digest=sha256(material);
  const signature=createHmac('sha256',String(secret||'')).update(digest).digest('hex');
  return{digest,signature,encoded:Buffer.from(material,'utf8').toString('base64')};
}

export function verifyImageMarketEvidenceBundle(env=process.env){
  const bundle=decodeBundle(env.IMAGE_MARKET_EVIDENCE_BUNDLE_B64);
  const secret=String(env.IMAGE_MARKET_EVIDENCE_SIGNING_SECRET||'');
  const suppliedSignature=clean(env.IMAGE_MARKET_EVIDENCE_SIGNATURE,128).toLowerCase();
  if(!bundle||secret.length<32||!HEX64.test(suppliedSignature))return{verified:false,bundle:null,digest:null,reason:'signed-evidence-bundle-missing'};
  if(number(bundle.schemaVersion)!==1)return{verified:false,bundle:null,digest:null,reason:'unsupported-evidence-schema'};
  const material=canonical(bundle);
  const digest=sha256(material);
  const expected=createHmac('sha256',secret).update(digest).digest('hex');
  if(!safeHexEqual(suppliedSignature,expected))return{verified:false,bundle:null,digest,reason:'evidence-signature-invalid'};
  return{verified:true,bundle,digest,reason:null};
}

function normalizedEvidence(bundle={},hardened={}){
  const source=bundle.evidence||{};
  return{
    liveProviderVerified:bool(source.liveProviderVerified)&&hardened.generation?.configured===true&&hardened.observerConnected===true&&hardened.safetyReady===true,
    verifiedOutputCount:Math.max(0,number(source.verifiedOutputCount)),
    qualityScore:Math.max(0,Math.min(100,number(source.qualityScore))),
    productionEvidenceId:clean(source.productionEvidenceId,180),
    evidenceSha256:HEX64.test(clean(source.evidenceSha256,64))?clean(source.evidenceSha256,64).toLowerCase():'',
    safetyPassed:bool(source.safetyPassed),
    provenanceVerified:bool(source.provenanceVerified),
    outputValidated:bool(source.outputValidated),
    observerSignedEvidence:bool(source.observerSignedEvidence),
    artifactHashBound:bool(source.artifactHashBound),
    providerSelfReported:source.providerSelfReported===true,
  };
}

function normalizedReliability(bundle={}){
  const source=bundle.reliability||{};
  return{
    sampleSize:Math.max(0,number(source.sampleSize)),
    successRate:Math.max(0,Math.min(1,number(source.successRate))),
    p95LatencyMs:Math.max(0,number(source.p95LatencyMs)),
    refundFailureRate:Math.max(0,Math.min(1,number(source.refundFailureRate,1))),
    evidenceSha256:HEX64.test(clean(source.evidenceSha256,64))?clean(source.evidenceSha256,64).toLowerCase():'',
    refundVerified:bool(source.refundVerified),
    idempotencyVerified:bool(source.idempotencyVerified),
    rateLimitVerified:bool(source.rateLimitVerified),
    abusePressureVerified:bool(source.abusePressureVerified),
    alternateProviderAvailable:bool(source.alternateProviderAvailable),
    providerFailoverVerified:bool(source.providerFailoverVerified),
  };
}

function normalizedRelease(bundle={},env=process.env){
  const source=bundle.release||{};
  const runtimeProductionSha=clean(env.VERCEL_GIT_COMMIT_SHA,40).toLowerCase();
  const bundleProductionSha=clean(source.productionSha,40).toLowerCase();
  const productionSha=HEX40.test(runtimeProductionSha)?runtimeProductionSha:bundleProductionSha;
  const mainSha=clean(source.mainSha,40).toLowerCase();
  const productionTarget=String(env.VERCEL_ENV||'').toLowerCase()==='production'&&clean(env.VERCEL_GIT_COMMIT_REF,120)==='main';
  return{
    authenticatedProductionE2E:bool(source.authenticatedProductionE2E),
    e2eEvidenceId:clean(source.e2eEvidenceId,180),
    releaseEvidenceSha256:HEX64.test(clean(source.releaseEvidenceSha256,64))?clean(source.releaseEvidenceSha256,64).toLowerCase():'',
    browserVerified:bool(source.browserVerified),
    mobileVerified:bool(source.mobileVerified),
    abuseSuitePassed:bool(source.abuseSuitePassed),
    monitoringReady:bool(source.monitoringReady),
    productionTarget,
    releaseApproved:bool(source.releaseApproved),
    mainSha,
    productionSha,
  };
}

export function getImageMarketRuntimeReadiness(env=process.env){
  const hardened=getImageProductionHardenedConfig(env);
  const verifiedBundle=verifyImageMarketEvidenceBundle(env);
  const bundle=verifiedBundle.verified?verifiedBundle.bundle:{};
  const runtime={hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true};
  const evidence=normalizedEvidence(bundle,hardened);
  const reliability=normalizedReliability(bundle);
  const release=normalizedRelease(bundle,env);
  const assessment=assessAiImageMarketReadiness({runtime,evidence,reliability,release});
  const blockers=[...assessment.blockers];
  if(!verifiedBundle.verified)blockers.unshift(verifiedBundle.reason||'signed-evidence-bundle-missing');
  if(hardened.generation?.configured!==true)blockers.unshift('approved-image-provider-not-configured');
  if(hardened.safetyReady!==true)blockers.unshift('provider-safety-ready-evidence-missing');
  if(hardened.observerConnected!==true)blockers.unshift('trusted-independent-observer-not-connected');
  const marketReady=verifiedBundle.verified&&hardened.generation?.configured===true&&hardened.safetyReady===true&&hardened.observerConnected===true&&assessment.marketReady;
  return Object.freeze({
    marketReady,
    decision:marketReady?'MARKET_SALES_READY':'HOLD',
    truth:marketReady?'PRODUCTION_LIVE_VERIFIED':'EVIDENCE_REQUIRED',
    evidenceBundleVerified:verifiedBundle.verified,
    evidenceBundleSha256:verifiedBundle.digest,
    providerConfigured:hardened.generation?.configured===true,
    providerSafetyReady:hardened.safetyReady===true,
    observerConfigured:hardened.observerConnected===true,
    observerKind:hardened.observerKind||null,
    layers:assessment.layers,
    passedLayers:assessment.passedLayers,
    totalLayers:assessment.totalLayers,
    blockers:Object.freeze([...new Set(blockers)]),
    evidence:Object.freeze(evidence),
    reliability:Object.freeze(reliability),
    release:Object.freeze(release),
    rule:assessment.rule,
  });
}
