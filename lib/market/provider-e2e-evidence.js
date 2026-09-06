const freeze=value=>Object.freeze(value);
const clean=(value,max=200)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const SHA256=/^[a-f0-9]{64}$/i,COMMIT=/^[a-f0-9]{40}$/i,ID=/^[A-Za-z0-9._:-]{1,200}$/;

export function validateMarketProviderReceipt(input={}){
  const r=input&&typeof input==='object'?input:{};const blockers=[];
  const providerRequestId=clean(r.providerRequestId,200),task=clean(r.task,120),assetId=clean(r.assetId,180),artifactSha256=clean(r.artifactSha256,64).toLowerCase(),productionSha=clean(r.productionSha,40).toLowerCase(),runtimeSha=clean(r.runtimeSha,40).toLowerCase(),qualityScore=Number(r.qualityScore);
  if(!ID.test(providerRequestId))blockers.push('provider-request-id');if(!task)blockers.push('media-task');if(!ID.test(assetId))blockers.push('durable-asset-id');if(!SHA256.test(artifactSha256))blockers.push('artifact-sha256');
  if(r.safetyPassed!==true)blockers.push('safety');if(r.provenanceVerified!==true)blockers.push('provenance');if(r.outputValidated!==true)blockers.push('output-validation');if(r.durablePersisted!==true)blockers.push('durable-persistence');if(r.durableReopenVerified!==true)blockers.push('durable-reopen');
  if(!Number.isFinite(qualityScore)||qualityScore<88)blockers.push('quality-score');if(!COMMIT.test(productionSha)||!COMMIT.test(runtimeSha)||productionSha!==runtimeSha)blockers.push('production-runtime-sha');
  if(r.providerLiveEvidence!==true)blockers.push('provider-live-evidence');if(r.realOutputQualityVerified!==true)blockers.push('real-output-quality');if(r.webdriver===true||r.synthetic===true||r.simulated===true)blockers.push('synthetic-evidence');
  return freeze({ok:blockers.length===0,blockers:freeze(blockers),providerRequestId:ID.test(providerRequestId)?providerRequestId:null,task:task||null,assetId:ID.test(assetId)?assetId:null,artifactSha256:SHA256.test(artifactSha256)?artifactSha256:null,qualityScore:Number.isFinite(qualityScore)?Math.max(0,Math.min(100,qualityScore)):null,productionSha:COMMIT.test(productionSha)?productionSha:null,runtimeSha:COMMIT.test(runtimeSha)?runtimeSha:null,evidenceClass:blockers.length===0?'PRODUCTION_REAL_OUTPUT':'EVIDENCE_REQUIRED'});
}

export async function persistMarketProviderReceipt({admin,userId,receipt}={}){
  const uid=clean(userId,180);if(!ID.test(uid))throw new Error('MARKET_PROVIDER_USER_INVALID');const checked=validateMarketProviderReceipt(receipt);if(!checked.ok)return freeze({saved:false,verified:false,blockers:checked.blockers});
  const row={user_id:uid,provider_request_id:checked.providerRequestId,media_task:checked.task,asset_id:checked.assetId,artifact_sha256:checked.artifactSha256,quality_score:checked.qualityScore,safety_passed:true,provenance_verified:true,output_validated:true,durable_reopen_verified:true,production_sha:checked.productionSha,runtime_sha:checked.runtimeSha,evidence_class:'PRODUCTION_REAL_OUTPUT'};
  const{data,error}=await admin.from('market_provider_evidence').upsert(row,{onConflict:'user_id,provider_request_id'}).select('id').single();if(error||!data?.id)throw new Error('MARKET_PROVIDER_EVIDENCE_SAVE_FAILED');return freeze({saved:true,verified:true,id:data.id});
}
