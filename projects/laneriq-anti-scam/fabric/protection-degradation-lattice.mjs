const Rank=Object.freeze({UNVERIFIED:0,DEGRADED:1,PARTIAL:2,VERIFIED:3});
export function combineProtectionStates(states=[]){
  if(!Array.isArray(states)||states.length===0) return {state:'UNVERIFIED',verified:false};
  const normalized=states.map(s=>Rank[String(s)]??0);
  const min=Math.min(...normalized);
  const state=Object.keys(Rank).find(k=>Rank[k]===min)||'UNVERIFIED';
  return {state,verified:state==='VERIFIED'};
}
export function claimedProtectionLevel({guardian='UNVERIFIED',web='UNVERIFIED',malware='UNVERIFIED',cloud='UNVERIFIED'}={}){
  const combined=combineProtectionStates([guardian,web,malware,cloud]);
  return {overall:combined.state,canClaimFullProtection:combined.verified,truthBoundary:'Overall protection cannot exceed the weakest independently verified layer.'};
}
