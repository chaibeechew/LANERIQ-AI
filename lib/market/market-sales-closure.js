const freeze=value=>Object.freeze(value);
const COMMIT=/^[a-f0-9]{40}$/i;
const clean=value=>String(value||'').trim().toLowerCase();

export const MARKET_SALES_LAYERS=freeze(['production_release','production_security','provider_e2e','commercial_billing']);

function evidenceRow(rows,kind){return (Array.isArray(rows)?rows:[]).find(row=>clean(row?.evidence_kind)===kind)||null;}
function verifiedEvidence(row,sha){return Boolean(row&&row.verified===true&&COMMIT.test(String(row.production_sha||''))&&String(row.production_sha).toLowerCase()===sha&&row.evidence_digest&&String(row.evidence_digest).length>=32);}

export function assessMarketSalesClosure({productionSha='',runtimeSha='',evidenceRows=[],billingRuntime={},providerReceiptCount=0,securityAdvisorWarnings=[]}={}){
  const prod=clean(productionSha),runtime=clean(runtimeSha);const exactSha=COMMIT.test(prod)&&prod===runtime;
  const release=verifiedEvidence(evidenceRow(evidenceRows,'production_release'),prod);
  const securityRow=verifiedEvidence(evidenceRow(evidenceRows,'production_security'),prod);const securityWarnings=Array.isArray(securityAdvisorWarnings)?securityAdvisorWarnings:[];const security=securityRow&&securityWarnings.length===0;
  const providerRow=verifiedEvidence(evidenceRow(evidenceRows,'provider_e2e'),prod);const provider=providerRow&&Number(providerReceiptCount)>0;
  const commercialRow=verifiedEvidence(evidenceRow(evidenceRows,'commercial_billing'),prod);const liveBilling=billingRuntime?.live===true&&billingRuntime?.configured===true&&billingRuntime?.liveCatalogReady===true&&billingRuntime?.launchApproved===true;const commercial=commercialRow&&liveBilling;
  const layers=freeze({production_release:release,production_security:security,provider_e2e:provider,commercial_billing:commercial});
  const blockers=[];if(!exactSha)blockers.push('production-runtime-exact-sha');for(const name of MARKET_SALES_LAYERS)if(!layers[name])blockers.push(name);if(!billingRuntime?.live)blockers.push('stripe-live-account');
  const sandboxCommercialReady=billingRuntime?.live===false&&billingRuntime?.configured===true&&billingRuntime?.testEnabled===true;
  return freeze({marketSellable:exactSha&&Object.values(layers).every(Boolean),exactSha,layers,blockers:freeze([...new Set(blockers)]),sandboxCommercialReady,truth:exactSha&&Object.values(layers).every(Boolean)?'MARKET_SALES_VERIFIED':'MARKET_SALES_EVIDENCE_REQUIRED',rule:'CODE, CI, Preview or sandbox payment evidence can never promote MARKET_SALES_VERIFIED without exact Production evidence for all four layers.'});
}
