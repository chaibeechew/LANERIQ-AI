import crypto from "node:crypto";

export const SUPPLY_CHAIN_ATTESTATION_VERSION="1.0.0";
const SHA256=/^[a-f0-9]{64}$/;
const TYPES=new Set(["model","provider","policy","tool","skill","runtime","dependency","dataset","workflow"]);
function text(value,max=160){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function requireDigest(value,name){const result=text(value,64).toLowerCase();if(!SHA256.test(result))throw new Error(`LANERIQ_SUPPLY_CHAIN_${name}_INVALID`);return result;}

export function createSupplyChainAttestation(input={}){
  const type=text(input.type,40).toLowerCase();if(!TYPES.has(type))throw new Error("LANERIQ_SUPPLY_CHAIN_TYPE_INVALID");
  const body=Object.freeze({
    version:SUPPLY_CHAIN_ATTESTATION_VERSION,
    type,
    subject:text(input.subject,160),
    exactVersion:text(input.exactVersion,120),
    artifactDigest:requireDigest(input.artifactDigest,"ARTIFACT_DIGEST"),
    policyDigest:input.policyDigest?requireDigest(input.policyDigest,"POLICY_DIGEST"):null,
    issuer:text(input.issuer,120),
    keyId:text(input.keyId,120),
    trustRootPinned:input.trustRootPinned===true,
    signatureVerified:input.signatureVerified===true,
    independentVerifier:input.independentVerifier===true,
    provenanceVerified:input.provenanceVerified===true,
    licenseVerified:input.licenseVerified!==false,
    vulnerabilityGatePassed:input.vulnerabilityGatePassed===true,
    revoked:input.revoked===true,
    observedAt:new Date(input.observedAt||Date.now()).toISOString(),
    containsSecrets:false,
    selfCertified:false,
  });
  if(!body.subject||!body.exactVersion||!body.issuer||!body.keyId)throw new Error("LANERIQ_SUPPLY_CHAIN_REQUIRED_FIELD_MISSING");
  return Object.freeze({...body,attestationDigest:digest(body)});
}

export function verifySupplyChainAttestation(attestation={},options={}){
  const body={...attestation};delete body.attestationDigest;
  const observed=Date.parse(attestation.observedAt||"");const now=Number(options.nowMs||Date.now());const maxAgeMs=Math.max(1000,Number(options.maxAgeMs||604800000));
  const checks=Object.freeze({
    exactVersion:Boolean(attestation.exactVersion),
    artifactDigest:SHA256.test(String(attestation.artifactDigest||"")),
    digestMatches:SHA256.test(String(attestation.attestationDigest||""))&&digest(body)===attestation.attestationDigest,
    trustRootPinned:attestation.trustRootPinned===true,
    signatureVerified:attestation.signatureVerified===true,
    independentVerifier:attestation.independentVerifier===true,
    provenanceVerified:attestation.provenanceVerified===true,
    licenseVerified:attestation.licenseVerified===true,
    vulnerabilityGatePassed:attestation.vulnerabilityGatePassed===true,
    notRevoked:attestation.revoked!==true,
    fresh:Number.isFinite(observed)&&observed<=now&&now-observed<=maxAgeMs,
    privacySafe:attestation.containsSecrets===false&&attestation.selfCertified===false,
  });
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return Object.freeze({verified:failed.length===0,checks,failed,mayGrantAuthority:false,maySelfPromoteProduction:false});
}

export function evaluateSupplyChainClosure(attestations=[],options={}){
  const requiredTypes=new Set((options.requiredTypes||["model","provider","policy","tool","runtime"]).map(v=>text(v,40).toLowerCase()));
  const verified=[];const rejected=[];
  for(const attestation of attestations){const result=verifySupplyChainAttestation(attestation,options);(result.verified?verified:rejected).push(Object.freeze({attestation,result}));}
  const verifiedTypes=new Set(verified.map(row=>row.attestation.type));
  const missingTypes=[...requiredTypes].filter(type=>!verifiedTypes.has(type));
  const duplicateSubjects=new Set();const seen=new Map();
  for(const {attestation} of verified){const prior=seen.get(attestation.subject);if(prior&&prior!==attestation.artifactDigest)duplicateSubjects.add(attestation.subject);seen.set(attestation.subject,attestation.artifactDigest);}
  const closed=rejected.length===0&&missingTypes.length===0&&duplicateSubjects.size===0;
  return Object.freeze({closed,verifiedCount:verified.length,rejectedCount:rejected.length,missingTypes:Object.freeze(missingTypes),conflictingSubjects:Object.freeze([...duplicateSubjects]),verifiedTypes:Object.freeze([...verifiedTypes]),closureDigest:digest(verified.map(row=>row.attestation.attestationDigest).sort()),productionClaimAllowed:false,humanApprovalStillRequired:true});
}
