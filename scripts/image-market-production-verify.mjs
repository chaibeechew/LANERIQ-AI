const HEX40=/^[a-f0-9]{40}$/i;
const MAX_BYTES=256*1024;
function required(name){const value=String(process.env[name]||'').trim();if(!value)throw new Error(`${name}_REQUIRED`);return value;}
function productionBase(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password)throw new Error('IMAGE_MARKET_PRODUCTION_URL_INVALID');url.pathname='/';url.search='';url.hash='';return url;}
async function fetchJson(url){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(url,{cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
    const length=Number(response.headers.get('content-length')||0);if(length>MAX_BYTES)throw new Error('IMAGE_MARKET_PRODUCTION_RESPONSE_TOO_LARGE');
    const raw=await response.text();if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw new Error('IMAGE_MARKET_PRODUCTION_RESPONSE_TOO_LARGE');
    if(!response.ok)throw new Error(`IMAGE_MARKET_PRODUCTION_HTTP_${response.status}`);
    return JSON.parse(raw);
  } finally {clearTimeout(timer);}
}

const base=productionBase(required('IMAGE_MARKET_PRODUCTION_URL'));
const expectedSha=required('IMAGE_MARKET_EXPECTED_MAIN_SHA').toLowerCase();
if(!HEX40.test(expectedSha))throw new Error('IMAGE_MARKET_EXPECTED_MAIN_SHA_INVALID');
const marketUrl=new URL('/api/images/market-readiness',base);
const codeUrl=new URL('/api/images/readiness',base);
const [market,code]=await Promise.all([fetchJson(marketUrl),fetchJson(codeUrl)]);
const failures=[];
if(market?.marketReady!==true)failures.push('market-readiness-not-ready');
if(market?.truth!=='PRODUCTION_LIVE_VERIFIED')failures.push('market-truth-not-live-verified');
if(market?.evidenceBundleVerified!==true)failures.push('signed-evidence-bundle-not-verified');
if(Number(market?.passedLayers)!==4||Number(market?.totalLayers)!==4)failures.push('four-layer-closure-incomplete');
if(market?.release?.productionTarget!==true)failures.push('runtime-is-not-production-main-target');
if(String(market?.release?.mainSha||'').toLowerCase()!==expectedSha)failures.push('evidence-main-sha-mismatch');
if(String(market?.release?.productionSha||'').toLowerCase()!==expectedSha)failures.push('production-runtime-sha-mismatch');
if(code?.marketSalesReady!==true)failures.push('public-image-readiness-not-market-ready');
if(code?.truth!=='PRODUCTION_LIVE_VERIFIED')failures.push('public-image-readiness-truth-mismatch');
const result={
  ok:failures.length===0,
  expectedMainSha:expectedSha,
  market:{marketReady:market?.marketReady===true,truth:market?.truth||null,evidenceBundleVerified:market?.evidenceBundleVerified===true,passedLayers:Number(market?.passedLayers||0),productionTarget:market?.release?.productionTarget===true,mainSha:market?.release?.mainSha||null,productionSha:market?.release?.productionSha||null},
  publicReadiness:{marketSalesReady:code?.marketSalesReady===true,truth:code?.truth||null},
  failures,
};
console.log(JSON.stringify(result,null,2));
if(failures.length){console.error('AI_IMAGE_PRODUCTION_VERIFY_BLOCKED: Production does not satisfy the signed four-layer exact-SHA market release contract.');process.exit(1);}
console.log('AI_IMAGE_PRODUCTION_VERIFY_READY: Production URL, signed four-layer evidence and exact main SHA all agree.');
