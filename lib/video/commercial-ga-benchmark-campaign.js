const freeze=v=>Object.freeze(v);
const clean=v=>String(v||'').trim();
const sha256=v=>/^[a-f0-9]{64}$/i.test(clean(v));

export const VIDEO_GA_BENCHMARK_CATEGORIES=freeze(['real-estate','product','brand-ad','character','cinematic','social-short','motion-control','image-to-video']);

export function validateBenchmarkCampaign({campaignId='',releaseId='',gitSha='',samples=[]}={}){
  const blockers=[];
  if(!clean(campaignId)) blockers.push('CAMPAIGN_ID_REQUIRED');
  if(!clean(releaseId)) blockers.push('RELEASE_ID_REQUIRED');
  if(!sha256(gitSha)) blockers.push('GIT_SHA_INVALID');
  const list=Array.isArray(samples)?samples:[];
  if(list.length<100) blockers.push('SAMPLE_COUNT_LT_100');
  const ids=new Set();
  const categories=new Set();
  let accepted=0,safetyPass=0,observed=0,hashes=0,provenance=0;
  const quality=[];
  for(const sample of list){
    const id=clean(sample.sampleId),category=clean(sample.category);
    if(!id) blockers.push('SAMPLE_ID_REQUIRED');
    else if(ids.has(id)) blockers.push(`DUPLICATE_SAMPLE_ID:${id}`); else ids.add(id);
    if(!VIDEO_GA_BENCHMARK_CATEGORIES.includes(category)) blockers.push(`CATEGORY_INVALID:${category||'unknown'}`); else categories.add(category);
    if(sample.independentlyObserved===true) observed++;
    if(sample.accepted===true) accepted++;
    if(sample.safetyPassed===true) safetyPass++;
    if(sha256(sample.artifactHash)) hashes++;
    if(clean(sample.provenanceId)) provenance++;
    if(Number.isFinite(Number(sample.qualityScore))) quality.push(Number(sample.qualityScore));
  }
  if(categories.size<6) blockers.push('CATEGORY_COVERAGE_LT_6');
  if(observed!==list.length) blockers.push('INDEPENDENT_OBSERVATION_INCOMPLETE');
  if(hashes!==list.length) blockers.push('ARTIFACT_HASH_COVERAGE_INCOMPLETE');
  if(provenance!==list.length) blockers.push('PROVENANCE_COVERAGE_INCOMPLETE');
  const acceptedRate=list.length?accepted/list.length:0;
  const safetyPassRate=list.length?safetyPass/list.length:0;
  const sorted=[...quality].sort((a,b)=>a-b);
  const p95=sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]:0;
  if(acceptedRate<0.9) blockers.push('ACCEPTED_RATE_LT_90_PERCENT');
  if(safetyPassRate<0.995) blockers.push('SAFETY_PASS_RATE_LT_99_5_PERCENT');
  if(p95<85) blockers.push('P95_QUALITY_LT_85');
  return freeze({ok:blockers.length===0,campaignId:clean(campaignId)||null,releaseId:clean(releaseId)||null,gitSha:clean(gitSha)||null,sampleCount:list.length,categoryCount:categories.size,acceptedRate,safetyPassRate,p95QualityScore:p95,blockers:freeze(blockers),truth:blockers.length===0?'REAL_VIDEO_BENCHMARK_VERIFIED':'REAL_VIDEO_BENCHMARK_REQUIRED'});
}
