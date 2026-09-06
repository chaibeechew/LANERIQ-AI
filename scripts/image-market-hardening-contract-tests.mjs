import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getImageMarketRuntimeReadiness } from '../lib/ai/image-market-runtime.js';

const envKeys=[
  'SOOLEN_COST_MODE','IMAGE_GENERATION_PROVIDER','IMAGE_GENERATION_ENDPOINT','IMAGE_GENERATION_TOKEN','IMAGE_GENERATION_COST_CLASS','IMAGE_GENERATION_CAPABILITIES','IMAGE_GENERATION_SAFETY_READY','IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT','IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID','IMAGE_MARKET_HARDENING_MODE','IMAGE_QUALITY_OBSERVER_ENDPOINT','IMAGE_QUALITY_OBSERVER_TOKEN','IMAGE_QUALITY_OBSERVER_SIGNING_SECRET','IMAGE_QUALITY_OBSERVER_KIND','IMAGE_QUALITY_OBSERVER_ID','IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE','IMAGE_MARKET_RELIABILITY_SUCCESS_RATE','IMAGE_MARKET_RELIABILITY_P95_MS','IMAGE_MARKET_REFUND_EVIDENCE_VERIFIED','IMAGE_MARKET_E2E_EVIDENCE_ID','IMAGE_MARKET_RELEASE_EVIDENCE_SHA256','IMAGE_MARKET_RELEASE_APPROVED'
];
const snapshot=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
function restore(){for(const key of envKeys){if(snapshot[key]===undefined)delete process.env[key];else process.env[key]=snapshot[key];}}
function setBase(){
  process.env.SOOLEN_COST_MODE='zero';
  process.env.IMAGE_GENERATION_PROVIDER='contract-image-provider';
  process.env.IMAGE_GENERATION_ENDPOINT='https://images.example.com/generate';
  process.env.IMAGE_GENERATION_TOKEN='test-token';
  process.env.IMAGE_GENERATION_COST_CLASS='zero';
  process.env.IMAGE_GENERATION_CAPABILITIES='text-to-image';
  process.env.IMAGE_GENERATION_SAFETY_READY='true';
  process.env.IMAGE_MARKET_HARDENING_MODE='enforce';
  process.env.IMAGE_QUALITY_OBSERVER_ENDPOINT='https://observer.example.com/judge';
  process.env.IMAGE_QUALITY_OBSERVER_TOKEN='observer-token';
  process.env.IMAGE_QUALITY_OBSERVER_SIGNING_SECRET='0123456789abcdef0123456789abcdef';
  process.env.IMAGE_QUALITY_OBSERVER_KIND='laneriq-vision';
  process.env.IMAGE_QUALITY_OBSERVER_ID='laneriq-image-quality-v1';
}

try{
  for(const key of envKeys)delete process.env[key];
  let readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false);
  assert.ok(readiness.blockers.includes('market-hardening-disabled'));

  setBase();
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.executionReady,true);
  assert.equal(readiness.marketReady,false);
  assert.ok(readiness.blockers.includes('live-provider-output-proof-missing'));
  assert.ok(readiness.blockers.includes('commercial-reliability-proof-missing'));

  process.env.IMAGE_GENERATION_VERIFIED_OUTPUT_COUNT='1';
  process.env.IMAGE_GENERATION_PRODUCTION_EVIDENCE_ID='img-live-proof-1';
  process.env.IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE='99';
  process.env.IMAGE_MARKET_RELIABILITY_SUCCESS_RATE='0.99';
  process.env.IMAGE_MARKET_RELIABILITY_P95_MS='30000';
  process.env.IMAGE_MARKET_REFUND_EVIDENCE_VERIFIED='true';
  process.env.IMAGE_MARKET_E2E_EVIDENCE_ID='image-prod-e2e-1';
  process.env.IMAGE_MARKET_RELEASE_EVIDENCE_SHA256='a'.repeat(64);
  process.env.IMAGE_MARKET_RELEASE_APPROVED='true';
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false,'99 samples must not satisfy the commercial reliability gate');

  process.env.IMAGE_MARKET_RELIABILITY_SAMPLE_SIZE='100';
  process.env.IMAGE_MARKET_RELIABILITY_SUCCESS_RATE='0.98';
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,true,'all four commercialization evidence layers should close only together');
  assert.equal(readiness.blockers.length,0);

  process.env.IMAGE_MARKET_RELIABILITY_SUCCESS_RATE='0.979';
  readiness=getImageMarketRuntimeReadiness();
  assert.equal(readiness.marketReady,false,'sub-98% reliability must fail closed');

  const route=fs.readFileSync(new URL('../app/api/images/generate/route.js',import.meta.url),'utf8');
  const runtime=fs.readFileSync(new URL('../lib/ai/image-market-runtime.js',import.meta.url),'utf8');
  const readinessRoute=fs.readFileSync(new URL('../app/api/images/market-readiness/route.js',import.meta.url),'utf8');
  assert.match(route,/runMarketHardenedImageGeneration/);
  assert.match(route,/market\.mode==="enforce"&&!market\.executionReady/);
  assert.match(route,/REAL_OUTPUT_QUALITY_VERIFIED|generated\.truth/);
  assert.match(route,/persistGeneratedImages\([\s\S]*lifecycle/);
  assert.match(runtime,/createHmac\('sha256'/);
  assert.match(runtime,/providerHash&&providerHash!==artifactHash/);
  assert.match(runtime,/signedEvidence:signatureVerified/);
  assert.match(runtime,/sampleSize>=100&&successRate>=0\.98/);
  assert.match(readinessRoute,/marketReady:readiness\.marketReady/);
  assert.doesNotMatch(readinessRoute,/SIGNING_SECRET|OBSERVER_TOKEN/);

  for(const file of ['lib/ai/image-market-runtime.js','app/api/images/generate/route.js','app/api/images/market-readiness/route.js']){
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(checked.status,0,`${file} must parse: ${checked.stderr||checked.stdout}`);
  }

  console.log('AI Image four-layer market hardening contracts passed.');
} finally { restore(); }
