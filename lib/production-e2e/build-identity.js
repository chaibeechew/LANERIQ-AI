const COMMIT_SHA=/^[0-9a-f]{40}$/i;

export function getProductionBuildIdentity(){
  const commitSha=String(process.env.VERCEL_GIT_COMMIT_SHA||"").trim().toLowerCase();
  const commitRef=String(process.env.VERCEL_GIT_COMMIT_REF||"").trim();
  const environment=String(process.env.VERCEL_ENV||"").trim().toLowerCase();
  const exactProductionBuildVerified=environment==="production"&&commitRef==="main"&&COMMIT_SHA.test(commitSha);
  return Object.freeze({commitSha,commitRef,environment,exactProductionBuildVerified});
}

export function assertExactProductionBuild(){
  const build=getProductionBuildIdentity();
  if(!build.exactProductionBuildVerified){
    const error=new Error("Production evidence is locked to an exact Vercel Production main deployment.");
    error.status=409;
    error.code="PRODUCTION_IDENTITY_REQUIRED";
    error.build=build;
    throw error;
  }
  return build;
}

export function isCommitSha(value){return COMMIT_SHA.test(String(value||"").trim());}
