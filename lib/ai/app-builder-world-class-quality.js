export const WORLD_CLASS_APP_QUALITY_VERSION="1.0.0";

export const DEFAULT_WORLD_CLASS_THRESHOLDS=Object.freeze({
  productValue:0.8,criticalFlowCompletion:0.95,usability:0.85,accessibility:0.9,security:0.95,reliability:0.95,storeReadiness:0.95,observability:0.9,
  web:Object.freeze({lcpMsP75:2500,inpMsP75:200,clsP75:0.1}),
});

const SCORE_KEYS=["productValue","criticalFlowCompletion","usability","accessibility","security","reliability","storeReadiness","observability"];

function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function bounded(v){return Math.max(0,Math.min(1,num(v)));}

export function evaluateWorldClassAppQuality(evidence={},options={}){
  const thresholds=options.thresholds||DEFAULT_WORLD_CLASS_THRESHOLDS;
  const checks=[];
  for(const key of SCORE_KEYS){
    const observed=bounded(evidence[key]);
    const required=num(thresholds[key],0.8);
    checks.push(Object.freeze({id:key,observed,required,pass:observed>=required}));
  }
  const web=evidence.web||{};
  if(evidence.target!=="app"){
    const lcp=num(web.lcpMsP75,Infinity),inp=num(web.inpMsP75,Infinity),cls=num(web.clsP75,Infinity);
    checks.push(Object.freeze({id:"web-lcp-p75",observed:lcp,required:`<=${thresholds.web.lcpMsP75}`,pass:lcp<=thresholds.web.lcpMsP75}));
    checks.push(Object.freeze({id:"web-inp-p75",observed:inp,required:`<=${thresholds.web.inpMsP75}`,pass:inp<=thresholds.web.inpMsP75}));
    checks.push(Object.freeze({id:"web-cls-p75",observed:cls,required:`<=${thresholds.web.clsP75}`,pass:cls<=thresholds.web.clsP75}));
  }
  const hardEvidence=Object.freeze({realDeviceVerified:Boolean(evidence.realDeviceVerified),realBrowserVerified:Boolean(evidence.realBrowserVerified),storeMetadataVerified:Boolean(evidence.storeMetadataVerified),privacyDisclosuresVerified:Boolean(evidence.privacyDisclosuresVerified),rollbackVerified:Boolean(evidence.rollbackVerified)});
  const machinePass=checks.every(x=>x.pass);
  const liveVerified=machinePass&&hardEvidence.realBrowserVerified&&hardEvidence.storeMetadataVerified&&hardEvidence.privacyDisclosuresVerified&&hardEvidence.rollbackVerified&&(evidence.target==="website"||hardEvidence.realDeviceVerified);
  return Object.freeze({version:WORLD_CLASS_APP_QUALITY_VERSION,checks:Object.freeze(checks),machinePass,hardEvidence,liveVerified,productionClaimAllowed:false,truthBoundary:"CODE/CI scores cannot substitute for browser, device, store, privacy, rollback or Production evidence."});
}
