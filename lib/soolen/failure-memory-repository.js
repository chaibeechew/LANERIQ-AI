import { appendFailureMemory, summarizeFailureMemory } from "./failure-memory-store.js";

export const FAILURE_MEMORY_REPOSITORY_VERSION="1.0.0";

function ensureAdapter(adapter){
  if(!adapter||typeof adapter.load!=="function"||typeof adapter.save!=="function")throw new Error("LANERIQ_FAILURE_MEMORY_ADAPTER_REQUIRED");
  return adapter;
}

export async function persistFailureMemory(adapter,scope,input={}){
  const target=ensureAdapter(adapter);
  const current=await target.load(scope);
  const next=appendFailureMemory(current||{},input);
  const saved=await target.save(scope,next);
  if(saved?.ok===false)throw new Error(saved?.error||"LANERIQ_FAILURE_MEMORY_SAVE_FAILED");
  return Object.freeze({version:FAILURE_MEMORY_REPOSITORY_VERSION,scope:String(scope||"").slice(0,200),summary:summarizeFailureMemory(next),persisted:true,storageClass:String(target.storageClass||"adapter-defined"),productionVerified:target.productionVerified===true});
}

export async function loadFailureMemory(adapter,scope,options={}){
  const target=ensureAdapter(adapter);
  const current=await target.load(scope);
  return Object.freeze({version:FAILURE_MEMORY_REPOSITORY_VERSION,scope:String(scope||"").slice(0,200),summary:summarizeFailureMemory(current||{},options),storageClass:String(target.storageClass||"adapter-defined"),productionVerified:target.productionVerified===true});
}
