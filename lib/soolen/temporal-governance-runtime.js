export const LANERIQ_TEMPORAL_GOVERNANCE_VERSION="1.0.0";

function text(v,max=500){return String(v??"").trim().slice(0,max);}
function year(v,fallback){const n=Number(v);return Number.isFinite(n)?Math.round(n):fallback;}

export function createTemporalAuthorityGrant(input={}){
  const issuedAtYear=year(input.issuedAtYear,new Date().getUTCFullYear());
  const expiresAtYear=year(input.expiresAtYear,issuedAtYear+1);
  if(expiresAtYear<=issuedAtYear)throw new Error("LANERIQ_TEMPORAL_GRANT_EXPIRY_REQUIRED");
  if(expiresAtYear-issuedAtYear>25)throw new Error("LANERIQ_TEMPORAL_GRANT_TOO_LONG");
  return Object.freeze({
    schemaVersion:"1",
    principal:text(input.principal,160),
    scope:text(input.scope,300),
    issuedAtYear,
    expiresAtYear,
    revocable:true,
    renewableOnlyByVerifiedAuthority:true,
    transferable:false,
    survivesModelReplacement:false,
    survivesRuntimeReplacement:false,
    becomesPermanentByAge:false,
  });
}

export function evaluateTemporalAuthority(grant,input={}){
  if(!grant)throw new Error("LANERIQ_TEMPORAL_GRANT_REQUIRED");
  const currentYear=year(input.currentYear,new Date().getUTCFullYear());
  const verifiedPrincipal=input.verifiedPrincipal===true;
  const revoked=input.revoked===true;
  const expired=currentYear>=grant.expiresAtYear;
  const valid=verifiedPrincipal&&!revoked&&!expired;
  return Object.freeze({valid,action:valid?"allow-within-scope":revoked?"deny-revoked":expired?"deny-expired":"deny-unverified",requiresReauthorization:!valid,oldAuthorityNeverSelfExtends:true});
}

export function createCenturyGoalContract(input={}){
  const startYear=year(input.startYear,new Date().getUTCFullYear());
  const reviewIntervalYears=Math.min(10,Math.max(1,year(input.reviewIntervalYears,1)));
  return Object.freeze({goal:text(input.goal,1200),startYear,reviewIntervalYears,maximumUnreviewedYears:10,automaticDormancyOnMissingAuthority:true,irreversibleGoalForbidden:true,periodicReauthorizationRequired:true,humanSuccessorAuthorityMayRevoke:true});
}
