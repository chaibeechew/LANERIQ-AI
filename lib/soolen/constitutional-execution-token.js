import crypto from "node:crypto";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const CONSTITUTIONAL_EXECUTION_TOKEN_VERSION="1.0.0";
const LAW=getHumanCivilizationLaw();
const MAX_TTL_SECONDS=15*60;
const MAX_CRITICAL_TTL_SECONDS=5*60;

function text(value,max=500){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function base64url(value){return Buffer.from(value).toString("base64url");}
function unbase64url(value){return Buffer.from(value,"base64url").toString("utf8");}
function secretBuffer(secret){const raw=Buffer.isBuffer(secret)?secret:Buffer.from(String(secret??""));if(raw.length<32)throw new Error("LANERIQ_CONSTITUTIONAL_TOKEN_SECRET_TOO_SHORT");return raw;}
function hmac(payload,secret){return crypto.createHmac("sha256",secretBuffer(secret)).update(payload).digest("base64url");}
function timingSafe(a,b){const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function level(value){const v=text(value||"medium",20).toLowerCase();return ["low","medium","high","critical"].includes(v)?v:"medium";}
function criticalAction(input,risk){return risk==="critical"||input.production===true||input.destructive===true||input.financial===true||input.physicalActuation===true||input.civilizationScale===true;}

export function issueConstitutionalExecutionToken(input={},secret){
  const scope=text(input.scope,200);const action=text(input.action,300);const principal=text(input.principal,500);
  if(!scope||!action||!principal)throw new Error("LANERIQ_CONSTITUTIONAL_TOKEN_SCOPE_ACTION_PRINCIPAL_REQUIRED");
  const risk=level(input.risk);const critical=criticalAction(input,risk);
  if((risk==="high"||critical)&&input.constitutionalAlignmentAccepted!==true)throw new Error("LANERIQ_CONSTITUTIONAL_ALIGNMENT_REQUIRED");
  if(critical&&input.humanApproved!==true)throw new Error("LANERIQ_CONSTITUTIONAL_HUMAN_APPROVAL_REQUIRED");
  const now=Number.isFinite(Number(input.nowMs))?Number(input.nowMs):Date.now();
  const requested=Math.max(1,Math.floor(Number(input.ttlSeconds)||300));
  const ttl=Math.min(requested,critical?MAX_CRITICAL_TTL_SECONDS:MAX_TTL_SECONDS);
  const payload=Object.freeze({
    v:CONSTITUTIONAL_EXECUTION_TOKEN_VERSION,
    lawDigest:LAW.lawDigest,
    principalDigest:digest(principal),
    authorityGrantDigest:text(input.authorityGrantDigest,64)||null,
    scope,
    actionDigest:digest(action),
    risk,
    issuedAt:now,
    expiresAt:now+ttl*1000,
    nonce:digest(`${now}|${Math.random()}|${scope}|${action}`).slice(0,32),
    humanApproved:input.humanApproved===true,
    constitutionalAlignmentAccepted:input.constitutionalAlignmentAccepted===true,
    externalSideEffects:input.externalSideEffects===true,
    production:input.production===true,
    destructive:input.destructive===true,
    financial:input.financial===true,
    physicalActuation:input.physicalActuation===true,
    civilizationScale:input.civilizationScale===true,
    delegationDepth:Math.max(0,Math.min(1,Number(input.delegationDepth)||0)),
    nonTransferable:true,
    containsRawPrincipal:false,
    containsRawAction:false,
  });
  const encoded=base64url(JSON.stringify(payload));
  return Object.freeze({token:`${encoded}.${hmac(encoded,secret)}`,payload,lawName:LAW.name,lawVersion:LAW.version});
}

export function verifyConstitutionalExecutionToken(token,secret,expected={}){
  const raw=text(token,20000);const parts=raw.split(".");
  if(parts.length!==2)return Object.freeze({valid:false,reason:"TOKEN_FORMAT_INVALID"});
  const [encoded,signature]=parts;let payload;
  try{payload=JSON.parse(unbase64url(encoded));}catch{return Object.freeze({valid:false,reason:"TOKEN_PAYLOAD_INVALID"});}
  const signatureValid=timingSafe(signature,hmac(encoded,secret));
  const now=Number.isFinite(Number(expected.nowMs))?Number(expected.nowMs):Date.now();
  const expectedAction=expected.action?digest(expected.action):null;
  const expectedPrincipal=expected.principal?digest(expected.principal):null;
  const checks=Object.freeze({
    signatureValid,
    versionCurrent:payload?.v===CONSTITUTIONAL_EXECUTION_TOKEN_VERSION,
    lawDigestCurrent:payload?.lawDigest===LAW.lawDigest,
    notExpired:Number(payload?.expiresAt)>now,
    issuedNotInFuture:Number(payload?.issuedAt)<=now+30_000,
    scopeMatches:!expected.scope||payload?.scope===expected.scope,
    actionMatches:!expectedAction||payload?.actionDigest===expectedAction,
    principalMatches:!expectedPrincipal||payload?.principalDigest===expectedPrincipal,
    authorityGrantMatches:!expected.authorityGrantDigest||payload?.authorityGrantDigest===expected.authorityGrantDigest,
    nonTransferable:payload?.nonTransferable===true,
    delegationDepthBounded:Number(payload?.delegationDepth)>=0&&Number(payload?.delegationDepth)<=1,
    highRiskAlignment:!["high","critical"].includes(String(payload?.risk))||payload?.constitutionalAlignmentAccepted===true,
    criticalHumanApproval:!criticalAction(payload,String(payload?.risk))||payload?.humanApproved===true,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return Object.freeze({valid:failed.length===0,reason:failed.length?"TOKEN_CHECK_FAILED":"VERIFIED",failed:Object.freeze(failed),checks,payload:Object.freeze({...payload,principalDigest:text(payload?.principalDigest,64),actionDigest:text(payload?.actionDigest,64)}),lawDigest:LAW.lawDigest,authorityExpanded:false});
}

export function authorizeConstitutionalExecution(input={}){
  const verification=input.verification;
  const toolGuardrailPassed=input.toolGuardrailPassed===true;
  const permissionScopeVerified=input.permissionScopeVerified===true;
  const humanVetoAvailable=input.humanVetoAvailable===true;
  const checks=Object.freeze({tokenVerified:verification?.valid===true,toolGuardrailPassed,permissionScopeVerified,humanVetoAvailable,lawDigestCurrent:verification?.lawDigest===LAW.lawDigest});
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return Object.freeze({allowed:failed.length===0,failed:Object.freeze(failed),checks,action:failed.length?"BLOCK":"ALLOW_WITHIN_EXISTING_AUTHORITY",mayExpandAuthority:false,mayBypassHumanVeto:false});
}
