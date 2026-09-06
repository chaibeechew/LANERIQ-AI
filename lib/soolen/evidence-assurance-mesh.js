import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const EVIDENCE_ASSURANCE_MESH_VERSION="1.0.0";
const SHA256=/^[a-f0-9]{64}$/;
const ALLOWED_CLASSES=new Set(Object.values(EVIDENCE_CLASSES));
const RANK=Object.freeze({INTERNAL:0,SIMULATED:1,STATIC_PREFLIGHT:2,MEASURED_OR_ATTESTED:3,PRODUCTION:4});

function text(value,max=200){return String(value??"").trim().slice(0,max);}
function sha(value){return crypto.createHash("sha256").update(String(value)).digest("hex");}
function canonical(value){return JSON.stringify(value,Object.keys(value).sort());}
function digest(value){return sha(canonical(value));}
function assertDigest(value,name){if(!SHA256.test(String(value||"")))throw new Error(`LANERIQ_EVIDENCE_INVALID_${name}`);return String(value);}
function assertNoRawPayload(input){for(const key of ["rawPrompt","rawOutput","customerData","secret","token","apiKey","password"]){if(input?.[key]!=null)throw new Error(`LANERIQ_EVIDENCE_RAW_PAYLOAD_FORBIDDEN:${key}`);}}

export function createEvidenceReceipt(input={}){
  assertNoRawPayload(input);
  const evidenceClass=text(input.evidenceClass,40).toUpperCase();
  if(!ALLOWED_CLASSES.has(evidenceClass))throw new Error("LANERIQ_EVIDENCE_CLASS_INVALID");
  const external=input.external===true;
  const independent=input.independent===true;
  const productionVerified=input.productionVerified===true;
  if(evidenceClass===EVIDENCE_CLASSES.PRODUCTION&&!(external&&independent&&productionVerified))throw new Error("LANERIQ_PRODUCTION_EVIDENCE_REQUIRES_EXTERNAL_INDEPENDENT_VERIFICATION");
  const body=Object.freeze({
    meshVersion:EVIDENCE_ASSURANCE_MESH_VERSION,
    receiptId:text(input.receiptId||sha(`${input.sourceClass}:${input.subject}:${input.observedAt||Date.now()}`).slice(0,24),48),
    sourceClass:text(input.sourceClass,80),
    subject:text(input.subject,160),
    evidenceClass,
    observedAt:new Date(input.observedAt||Date.now()).toISOString(),
    artifactDigest:assertDigest(input.artifactDigest,"ARTIFACT_DIGEST"),
    methodDigest:input.methodDigest?assertDigest(input.methodDigest,"METHOD_DIGEST"):null,
    external,
    independent,
    productionVerified,
    containsRawPrompt:false,
    containsRawOutput:false,
    containsCustomerData:false,
    containsSecrets:false,
  });
  return Object.freeze({...body,receiptDigest:digest(body)});
}

export function verifyEvidenceReceipt(receipt={},options={}){
  const now=Number(options.nowMs||Date.now());
  const observed=Date.parse(receipt.observedAt||"");
  const maxAgeMs=Math.max(1000,Number(options.maxAgeMs||86400000));
  const body={...receipt};delete body.receiptDigest;
  const checks=Object.freeze({
    shape:Boolean(receipt.receiptId&&receipt.sourceClass&&receipt.subject&&ALLOWED_CLASSES.has(receipt.evidenceClass)),
    artifactDigest:SHA256.test(String(receipt.artifactDigest||"")),
    digestMatches:SHA256.test(String(receipt.receiptDigest||""))&&digest(body)===receipt.receiptDigest,
    fresh:Number.isFinite(observed)&&observed<=now&&now-observed<=maxAgeMs,
    privacySafe:receipt.containsRawPrompt===false&&receipt.containsRawOutput===false&&receipt.containsCustomerData===false&&receipt.containsSecrets===false,
    productionBound:receipt.evidenceClass!==EVIDENCE_CLASSES.PRODUCTION||(receipt.external===true&&receipt.independent===true&&receipt.productionVerified===true),
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
  return Object.freeze({verified:failed.length===0,checks,failed});
}

export function aggregateEvidenceReceipts(receipts=[],options={}){
  const requiredSources=[...(options.requiredSourceClasses||[])].map(v=>text(v,80));
  const verified=[];const rejected=[];
  for(const receipt of receipts){const result=verifyEvidenceReceipt(receipt,options);(result.verified?verified:rejected).push(Object.freeze({receipt,result}));}
  const sourceClasses=new Set(verified.map(row=>row.receipt.sourceClass));
  const missingSources=requiredSources.filter(source=>!sourceClasses.has(source));
  const subjects=new Map();
  for(const {receipt} of verified){const current=subjects.get(receipt.subject)||new Set();current.add(receipt.artifactDigest);subjects.set(receipt.subject,current);}
  const contradictions=[...subjects.entries()].filter(([,digests])=>digests.size>1).map(([subject])=>subject);
  let evidenceClass=EVIDENCE_CLASSES.INTERNAL;
  if(verified.length){const minimumRank=Math.min(...verified.map(row=>RANK[row.receipt.evidenceClass]??0));evidenceClass=Object.keys(RANK).find(key=>RANK[key]===minimumRank)||EVIDENCE_CLASSES.INTERNAL;}
  const productionEligible=verified.length>0&&missingSources.length===0&&contradictions.length===0&&rejected.length===0&&verified.every(row=>row.receipt.evidenceClass===EVIDENCE_CLASSES.PRODUCTION&&row.receipt.productionVerified===true);
  return Object.freeze({
    verifiedCount:verified.length,rejectedCount:rejected.length,sourceClasses:Object.freeze([...sourceClasses]),missingSources:Object.freeze(missingSources),contradictions:Object.freeze(contradictions),evidenceClass:productionEligible?EVIDENCE_CLASSES.PRODUCTION:evidenceClass,productionEligible,mayCloseProductionByItself:false,
    aggregateDigest:digest(verified.map(row=>row.receipt.receiptDigest).sort()),
  });
}
