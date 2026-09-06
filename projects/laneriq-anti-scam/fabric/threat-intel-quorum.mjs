export function evaluateThreatIntelQuorum(verdicts=[], {minIndependentSources=2}={}){
  const valid=(verdicts||[]).filter(v=>v?.signatureVerified===true&&v?.artifactBound===true&&v?.fresh===true&&v?.sourceId);
  const sources=new Set(valid.map(v=>v.sourceId));
  if(sources.size<minIndependentSources) return {ready:false,code:'INDEPENDENT_SOURCE_QUORUM_MISSING',sourceCount:sources.size};
  const malicious=valid.filter(v=>v.verdict==='MALICIOUS');
  const clean=valid.filter(v=>v.verdict==='CLEAN');
  if(malicious.length&&clean.length) return {ready:false,code:'SOURCE_CONFLICT',malicious:malicious.length,clean:clean.length};
  if(malicious.length>=minIndependentSources) return {ready:true,verdict:'MALICIOUS',sourceCount:sources.size};
  if(clean.length>=minIndependentSources) return {ready:true,verdict:'CLEAN',sourceCount:sources.size};
  return {ready:false,code:'VERDICT_QUORUM_NOT_MET',sourceCount:sources.size};
}
