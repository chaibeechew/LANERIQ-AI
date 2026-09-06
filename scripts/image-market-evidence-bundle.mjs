import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assessAiImageMarketReadiness} from '../lib/ai/image-market-readiness.js';
import {signImageMarketEvidenceBundle} from '../lib/ai/image-market-runtime.js';

const HEX64=/^[a-f0-9]{64}$/i;
const clean=(value,max=4000)=>String(value||'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function percentile95(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return 0;
  return sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)];
}
function readManifest(file){
  const raw=fs.readFileSync(file,'utf8');
  if(Buffer.byteLength(raw,'utf8')>4*1024*1024)throw new Error('AI_IMAGE_EVIDENCE_INPUT_TOO_LARGE');
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Number(parsed.schemaVersion)!==1)throw new Error('AI_IMAGE_EVIDENCE_SCHEMA_INVALID');
  return parsed;
}
function validOutput(item){
  return item&&typeof item==='object'
    &&item.truth==='REAL_OUTPUT_QUALITY_VERIFIED'
    &&item.providerSelfReported===false
    &&item.observerSignedEvidence===true
    &&item.artifactHashBound===true
    &&item.safetyPassed===true
    &&item.provenanceVerified===true
    &&item.outputValidated===true
    &&HEX64.test(clean(item.artifactSha256,64))
    &&finite(item.qualityScore)!==null
    &&finite(item.qualityScore)>=0
    &&finite(item.qualityScore)<=100;
}
function validSample(item){
  return item&&typeof item==='object'&&finite(item.latencyMs)!==null&&finite(item.latencyMs)>=0&&typeof item.success==='boolean';
}

const file=process.argv[2]||process.env.IMAGE_MARKET_RAW_EVIDENCE_FILE;
if(!file){console.error('Usage: node scripts/image-market-evidence-bundle.mjs <raw-evidence.json>');process.exit(2);}
const manifest=readManifest(file);
const outputs=(Array.isArray(manifest.outputs)?manifest.outputs:[]).filter(validOutput);
const samples=(Array.isArray(manifest.reliabilitySamples)?manifest.reliabilitySamples:[]).filter(validSample);
const attestations=manifest.attestations&&typeof manifest.attestations==='object'?manifest.attestations:{};
const release=manifest.release&&typeof manifest.release==='object'?manifest.release:{};

const qualityScore=outputs.length?outputs.reduce((sum,item)=>sum+Number(item.qualityScore),0)/outputs.length:0;
const successful=samples.filter(item=>item.success===true).length;
const successRate=samples.length?successful/samples.length:0;
const failedCharged=samples.filter(item=>item.success===false&&item.charged===true);
const refundFailures=failedCharged.filter(item=>item.refundSucceeded!==true).length;
const refundFailureRate=failedCharged.length?refundFailures/failedCharged.length:0;
const outputEvidenceMaterial=outputs.map(item=>({
  requestId:clean(item.requestId,160),artifactSha256:clean(item.artifactSha256,64).toLowerCase(),qualityScore:Number(item.qualityScore),
  safetyPassed:true,provenanceVerified:true,outputValidated:true,observerSignedEvidence:true,artifactHashBound:true,providerSelfReported:false,
}));
const reliabilityMaterial=samples.map(item=>({requestId:clean(item.requestId,160),success:item.success===true,latencyMs:Number(item.latencyMs),charged:item.charged===true,refundSucceeded:item.refundSucceeded===true}));

const bundle={
  schemaVersion:1,
  evidence:{
    liveProviderVerified:outputs.length>0,
    verifiedOutputCount:outputs.length,
    qualityScore:Number(qualityScore.toFixed(4)),
    productionEvidenceId:clean(manifest.productionEvidenceId,180),
    evidenceSha256:sha(outputEvidenceMaterial),
    safetyPassed:outputs.length>0&&outputs.every(item=>item.safetyPassed===true),
    provenanceVerified:outputs.length>0&&outputs.every(item=>item.provenanceVerified===true),
    outputValidated:outputs.length>0&&outputs.every(item=>item.outputValidated===true),
    observerSignedEvidence:outputs.length>0&&outputs.every(item=>item.observerSignedEvidence===true),
    artifactHashBound:outputs.length>0&&outputs.every(item=>item.artifactHashBound===true),
    providerSelfReported:outputs.some(item=>item.providerSelfReported===true),
  },
  reliability:{
    sampleSize:samples.length,
    successRate:Number(successRate.toFixed(6)),
    p95LatencyMs:percentile95(samples.map(item=>Number(item.latencyMs))),
    refundFailureRate:Number(refundFailureRate.toFixed(6)),
    evidenceSha256:sha({samples:reliabilityMaterial,attestations}),
    refundVerified:failedCharged.every(item=>item.refundSucceeded===true)&&attestations.refundVerified===true,
    idempotencyVerified:attestations.idempotencyVerified===true,
    rateLimitVerified:attestations.rateLimitVerified===true,
    abusePressureVerified:attestations.abusePressureVerified===true,
    alternateProviderAvailable:attestations.alternateProviderAvailable===true,
    providerFailoverVerified:attestations.providerFailoverVerified===true,
  },
  release:{
    authenticatedProductionE2E:release.authenticatedProductionE2E===true,
    e2eEvidenceId:clean(release.e2eEvidenceId,180),
    releaseEvidenceSha256:sha({
      e2eEvidenceId:clean(release.e2eEvidenceId,180),browserVerified:release.browserVerified===true,mobileVerified:release.mobileVerified===true,
      abuseSuitePassed:release.abuseSuitePassed===true,monitoringReady:release.monitoringReady===true,releaseApproved:release.releaseApproved===true,
      mainSha:clean(release.mainSha,40).toLowerCase(),productionSha:clean(release.productionSha,40).toLowerCase(),
    }),
    browserVerified:release.browserVerified===true,
    mobileVerified:release.mobileVerified===true,
    abuseSuitePassed:release.abuseSuitePassed===true,
    monitoringReady:release.monitoringReady===true,
    releaseApproved:release.releaseApproved===true,
    mainSha:clean(release.mainSha,40).toLowerCase(),
    productionSha:clean(release.productionSha,40).toLowerCase(),
  },
};

const runtime={hardenedExecutionWired:true,failClosedQualityGate:true,creditsAtomic:true,durableCapture:true};
const assessment=assessAiImageMarketReadiness({runtime,evidence:bundle.evidence,reliability:bundle.reliability,release:{...bundle.release,productionTarget:release.productionTarget===true}});
const secret=String(process.env.IMAGE_MARKET_EVIDENCE_SIGNING_SECRET||'');
const signed=secret.length>=32?signImageMarketEvidenceBundle(bundle,secret):null;
const result={
  bundle,
  bundleSha256:signed?.digest||sha(bundle),
  signature:signed?.signature||null,
  encodedBundle:signed?.encoded||null,
  assessment:{marketReady:assessment.marketReady,passedLayers:assessment.passedLayers,totalLayers:assessment.totalLayers,blockers:assessment.blockers},
  rawCounts:{outputsProvided:Array.isArray(manifest.outputs)?manifest.outputs.length:0,outputsVerified:outputs.length,samplesProvided:Array.isArray(manifest.reliabilitySamples)?manifest.reliabilitySamples.length:0,samplesValid:samples.length},
};
console.log(JSON.stringify(result,null,2));
if(process.env.IMAGE_MARKET_REQUIRE_READY==='true'&&!assessment.marketReady)process.exit(1);
