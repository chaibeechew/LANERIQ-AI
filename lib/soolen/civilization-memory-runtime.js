import crypto from "node:crypto";

export const LANERIQ_CIVILIZATION_MEMORY_VERSION="1.0.0";

function text(v,max=4000){return String(v??"").trim().slice(0,max);}
function digest(v){return crypto.createHash("sha256").update(String(v)).digest("hex");}

export function createEpistemicTimeCapsule(input={}){
  if(input.rawSecrets||input.credentials||input.privateCustomerPayload)throw new Error("LANERIQ_TIME_CAPSULE_PRIVATE_DATA_REJECTED");
  const statement=text(input.statement,3000);
  const evidenceRefs=Array.isArray(input.evidenceRefs)?input.evidenceRefs.map(v=>text(v,300)).filter(Boolean).slice(0,100):[];
  const priorDigest=text(input.priorDigest,64);
  const capsuleDigest=digest(JSON.stringify({statement,evidenceRefs,priorDigest,schemaVersion:"1"}));
  return Object.freeze({schemaVersion:"1",createdAt:new Date().toISOString(),statementDigest:digest(statement),evidenceRefs,priorDigest,capsuleDigest,tamperEvidentNotTamperProof:true,rawStatementPersisted:false,requiresPeriodicFormatMigration:true,requiresIndependentWitnesses:true});
}

export function planArchiveMigration(input={}){
  return Object.freeze({sourceFormat:text(input.sourceFormat||"unknown",80),targetFormat:text(input.targetFormat||"future-self-describing",80),preserveOriginalDigest:true,preserveMigrationLineage:true,semanticEquivalenceVerificationRequired:true,multiReaderVerificationRequired:true,destructiveRewriteForbidden:true,oldFormatRetainedUntilVerified:true});
}

export function evaluateArchiveContinuity(input={}){
  const accepted=input.originalDigestVerified===true&&input.lineageVerified===true&&input.semanticEquivalenceVerified===true&&input.multipleReadersAgree===true;
  return Object.freeze({accepted,action:accepted?"accept-migrated-copy":"retain-original-and-block-promotion",originalRemainsAuthoritativeUntilVerified:true});
}
