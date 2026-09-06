import crypto from "node:crypto";

export const LIVE_EVIDENCE_ENGINE_VERSION="1.0.0";
export const EVIDENCE_LADDER=Object.freeze(["SPEC","CODE","CI","BROWSER_VERIFIED","DEVICE_VERIFIED","PROVIDER_LIVE","PRODUCTION"]);
const SHA40=/^[a-f0-9]{40}$/;
const FORBIDDEN_KEYS=/secret|password|token|credential|authorization|cookie|rawprompt|rawoutput|privatekey/i;

function text(value,max=240){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(typeof value==="string"?value:JSON.stringify(value)).digest("hex");}
function sanitizeObject(input={}){
  const out={};
  for(const [key,value] of Object.entries(input||{})){
    if(FORBIDDEN_KEYS.test(key))throw new Error(`LANERIQ_EVIDENCE_FORBIDDEN_FIELD:${key}`);
    if(value===undefined||typeof value==="function")continue;
    out[key]=typeof value==="string"?value.slice(0,1000):value;
  }
  return Object.freeze(out);
}
function classIndex(value){return EVIDENCE_LADDER.indexOf(String(value||"").toUpperCase());}

export function createEvidenceRecord(input={}){
  const evidenceClass=String(input.class||"").toUpperCase();
  if(classIndex(evidenceClass)<0)throw new Error("LANERIQ_EVIDENCE_CLASS_INVALID");
  const candidateSha=text(input.candidateSha,40).toLowerCase();
  if(!SHA40.test(candidateSha))throw new Error("LANERIQ_EVIDENCE_CANDIDATE_SHA_REQUIRED");
  const source=text(input.source,160);if(!source)throw new Error("LANERIQ_EVIDENCE_SOURCE_REQUIRED");
  const verdict=String(input.verdict||"BLOCK").toUpperCase();
  if(!["PASS","BLOCK"].includes(verdict))throw new Error("LANERIQ_EVIDENCE_VERDICT_INVALID");
  const metadata=sanitizeObject(input.metadata||{});
  const observedAt=input.observedAt?new Date(input.observedAt):new Date();
  if(Number.isNaN(observedAt.getTime()))throw new Error("LANERIQ_EVIDENCE_TIME_INVALID");
  const canonical={candidateSha,evidenceClass,source,observedAt:observedAt.toISOString(),verdict,metadata};
  return Object.freeze({
    evidenceId:`ev_${digest(canonical).slice(0,24)}`,
    class:evidenceClass,
    candidateSha,
    source,
    observedAt:canonical.observedAt,
    digest:digest(canonical),
    verdict,
    metadata,
    containsSecrets:false,
    rawPromptStored:false,
    rawOutputStored:false,
  });
}

export function evaluateEvidenceSet(records=[],input={}){
  const list=(Array.isArray(records)?records:[]).filter(Boolean);
  const candidateSha=text(input.candidateSha||list[0]?.candidateSha,40).toLowerCase();
  const targetClass=String(input.targetClass||"CI").toUpperCase();
  const targetIndex=classIndex(targetClass);
  if(!SHA40.test(candidateSha)||targetIndex<0)return Object.freeze({accepted:false,failed:Object.freeze(["candidate-or-target-invalid"]),highestClass:"SPEC",productionClaimAllowed:false});
  const failed=[];const accepted=list.filter(row=>row.candidateSha===candidateSha&&row.verdict==="PASS"&&classIndex(row.class)>=0);
  if(list.some(row=>row.candidateSha!==candidateSha))failed.push("candidate-sha-drift");
  const requiredSources=[...(input.requiredSources||[])].map(v=>String(v));
  for(const source of requiredSources)if(!accepted.some(row=>row.source===source))failed.push(`missing-source:${source}`);
  const highestIndex=accepted.reduce((max,row)=>Math.max(max,classIndex(row.class)),0);
  if(highestIndex<targetIndex)failed.push(`insufficient-class:${targetClass}`);
  const github=text(input.githubMainSha,40).toLowerCase();const vercel=text(input.vercelProductionSha,40).toLowerCase();const runtime=text(input.runtimeVerifiedSha,40).toLowerCase();
  if(targetClass==="PRODUCTION"){
    if(!(SHA40.test(github)&&github===candidateSha&&github===vercel&&github===runtime))failed.push("exact-sha-convergence");
    if(input.humanReleaseApproval!==true)failed.push("human-release-approval");
    if(input.liveEvidenceVerified!==true)failed.push("live-evidence-verification");
  }
  return Object.freeze({
    version:LIVE_EVIDENCE_ENGINE_VERSION,
    candidateSha,
    targetClass,
    accepted:failed.length===0,
    failed:Object.freeze(failed),
    recordCount:list.length,
    acceptedRecordCount:accepted.length,
    highestClass:EVIDENCE_LADDER[highestIndex],
    productionClaimAllowed:targetClass==="PRODUCTION"&&failed.length===0,
    staticCiCanSelfPromoteToProduction:false,
    previewCanSelfPromoteToProduction:false,
  });
}

export function buildLiveEvidenceClosureManifest(input={}){
  const lanes=Object.freeze(Object.fromEntries(Object.entries(input.lanes||{}).map(([name,value])=>[name,value===true])));
  const failedLanes=Object.entries(lanes).filter(([,ok])=>!ok).map(([name])=>name);
  return Object.freeze({
    version:LIVE_EVIDENCE_ENGINE_VERSION,
    candidateSha:text(input.candidateSha,40).toLowerCase()||null,
    lanes,
    failedLanes:Object.freeze(failedLanes),
    verdict:failedLanes.length?"BLOCK":"PASS",
    mayClaimProductionClosed:failedLanes.length===0&&input.humanReleaseApproval===true,
    humanReleaseApprovalRequired:true,
    generatedEvidenceMayNotSynthesizeHumanApproval:true,
  });
}
