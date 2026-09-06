import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const MULTI_PROVIDER_BENCHMARK_VERSION = "1.0.0";
const LOCAL_PROVIDERS = new Set(["ollama","soolen-local"]);

function text(value,max=12000){return String(value??"").trim().slice(0,max);}
function sha(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function clampScore(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
async function aiProviderModule(){return import("../../engine/ai-provider.js");}
async function defaultGenerate(prompt,provider){const {generateWithFallback}=await aiProviderModule();return generateWithFallback(prompt,{providers:[provider]});}
async function configuredRemoteProviders(){
  try{const {getProviderRuntimeHealth}=await aiProviderModule();return getProviderRuntimeHealth().filter(x=>x.configured===true&&!LOCAL_PROVIDERS.has(String(x.provider))).map(x=>String(x.provider));}catch{return[];}
}

export async function runMultiProviderBenchmark(input={},deps={}){
  const campaignId=text(input.campaignId||`real-provider-${Date.now()}`,120);
  const cases=Array.isArray(input.cases)?input.cases.slice(0,100):[];
  if(!cases.length)throw new Error("LANERIQ_REAL_BENCHMARK_CASES_REQUIRED");
  const evaluate=deps.evaluate;
  if(typeof evaluate!=="function")throw new Error("LANERIQ_REAL_BENCHMARK_EVALUATOR_REQUIRED");
  const generate=typeof deps.generate==="function"?deps.generate:defaultGenerate;
  const configured=Array.isArray(input.providers)&&input.providers.length?[...new Set(input.providers.map(v=>text(v,80).toLowerCase()).filter(Boolean))]:await configuredRemoteProviders();
  const providers=configured.filter(p=>!LOCAL_PROVIDERS.has(p)).slice(0,8);
  if(providers.length<2)throw new Error("LANERIQ_REAL_BENCHMARK_REQUIRES_TWO_EXTERNAL_PROVIDERS");
  const receipts=[];
  const actualProviders=new Set();
  for(const testCase of cases){
    const caseId=text(testCase?.id,240);const domain=text(testCase?.domain,80);const prompt=text(testCase?.prompt,16000);
    if(!caseId||!domain||!prompt)throw new Error("LANERIQ_REAL_BENCHMARK_CASE_INVALID");
    const promptDigest=sha(prompt);
    for(const requestedProvider of providers){
      const started=Date.now();
      const response=await generate(prompt,requestedProvider,testCase);
      const raw=typeof response==="string"?response:text(response?.result,50000);
      const actualProvider=typeof response==="object"?text(response?.provider||requestedProvider,80).toLowerCase():requestedProvider;
      if(!actualProvider||LOCAL_PROVIDERS.has(actualProvider))throw new Error("LANERIQ_REAL_BENCHMARK_EXTERNAL_PROVIDER_NOT_OBSERVED");
      actualProviders.add(actualProvider);
      const evaluation=await evaluate({caseId,domain,promptDigest,requestedProvider,actualProvider,result:raw,testCase});
      const score=clampScore(evaluation?.score);const passed=evaluation?.passed===true;
      receipts.push(Object.freeze({campaignId,caseId,domain,requestedProvider,providerClass:actualProvider,modelClass:text(evaluation?.modelClass,120),score,passed,evidenceClass:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,externallyVerified:false,durationMs:Date.now()-started,promptDigest,resultDigest:sha(raw),evaluatorDigest:sha(JSON.stringify({score,passed,reason:text(evaluation?.reason,1000)}))}));
    }
  }
  const distinctExternalProviders=[...actualProviders];
  const realMultiProviderObserved=distinctExternalProviders.length>=2;
  const passRate=receipts.length?receipts.filter(x=>x.passed).length/receipts.length:0;
  const average=receipts.length?receipts.reduce((sum,x)=>sum+x.score,0)/receipts.length:0;
  return Object.freeze({version:MULTI_PROVIDER_BENCHMARK_VERSION,campaignId,requestedProviders:Object.freeze(providers),distinctExternalProviders:Object.freeze(distinctExternalProviders),distinctExternalProviderCount:distinctExternalProviders.length,realMultiProviderObserved,receiptCount:receipts.length,passRate,averageScore:average,receipts:Object.freeze(receipts),evidenceClass:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,mayClaimProductionVerified:false,productionPromotionRequiresIndependentAttestation:true,rawPromptsPersisted:false,rawOutputsPersisted:false});
}

export async function persistMultiProviderBenchmark(adapter,benchmark){
  if(!adapter||typeof adapter.append!=="function")throw new Error("LANERIQ_BENCHMARK_EVIDENCE_ADAPTER_REQUIRED");
  if(!benchmark?.realMultiProviderObserved)throw new Error("LANERIQ_REAL_MULTI_PROVIDER_EVIDENCE_REQUIRED");
  const results=[];
  for(const receipt of benchmark.receipts||[])results.push(await adapter.append(receipt));
  return Object.freeze({persisted:results.length,storageClass:String(adapter.storageClass||"adapter-defined"),productionVerified:adapter.productionVerified===true&&results.length>0,mayClaimProductionVerified:false});
}
