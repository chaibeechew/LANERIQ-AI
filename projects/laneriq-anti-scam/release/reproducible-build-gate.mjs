const SHA256=/^[0-9a-f]{64}$/i;

export function evaluateReproducibleBuild(runs=[]){
  if(!Array.isArray(runs)||runs.length<2) return {ready:false,code:'INSUFFICIENT_BUILD_RUNS'};
  const normalized=runs.map(r=>({artifactSha256:String(r?.artifactSha256||''),sourceSha:String(r?.sourceSha||''),toolchain:String(r?.toolchain||''),cleanBuild:r?.cleanBuild===true}));
  if(normalized.some(r=>!SHA256.test(r.artifactSha256)||!/^[0-9a-f]{40}$/i.test(r.sourceSha)||!r.toolchain||!r.cleanBuild)) return {ready:false,code:'BUILD_EVIDENCE_INVALID'};
  const first=normalized[0];
  const same=normalized.every(r=>r.artifactSha256===first.artifactSha256&&r.sourceSha===first.sourceSha&&r.toolchain===first.toolchain);
  return same?{ready:true,code:'REPRODUCIBLE_BUILD_VERIFIED',artifactSha256:first.artifactSha256,sourceSha:first.sourceSha,runCount:normalized.length}:{ready:false,code:'REPRODUCIBLE_BUILD_MISMATCH'};
}
