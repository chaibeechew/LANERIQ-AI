import crypto from "node:crypto";

export const LANERIQ_PROTOCOL_CRYPTO_EVOLUTION_VERSION="1.0.0";

function text(v,max=1000){return String(v??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value)).digest("hex");}

export function createVersionedProtocolEnvelope(input={}){
  const protocol=text(input.protocol||"laneriq-canonical",120);
  const schemaVersion=text(input.schemaVersion||"1",40);
  const payload=input.payload??{};
  return Object.freeze({protocol,schemaVersion,selfDescribing:true,canonicalIntent:text(input.canonicalIntent,600),payloadDigest:digest(JSON.stringify(payload)),unknownFieldsPreserved:true,adapterMayNotIncreaseAuthority:true,adapterMayNotRaiseEvidence:true,backwardCompatibilityRequired:true});
}

export function planCryptoAgility(input={}){
  const currentSuite=text(input.currentSuite||"current-approved-suite",120);
  const candidateSuite=text(input.candidateSuite||"next-approved-suite",120);
  return Object.freeze({currentSuite,candidateSuite,dualValidationDuringMigration:true,keyMaterialNeverEmbeddedInProtocol:true,algorithmIdentifiersVersioned:true,rollbackSupported:true,independentValidationRequired:true,automaticSecurityDowngradeForbidden:true,unknownFutureAlgorithmSupportedByRegistry:true,productionCutoverRequiresApproval:true});
}

export function evaluateProtocolMigration(input={}){
  const testsPassed=input.testsPassed===true;
  const securityValidated=input.securityValidated===true;
  const compatibilityPassed=input.compatibilityPassed===true;
  const authorityPreserved=input.authorityPreserved===true;
  const evidencePreserved=input.evidencePreserved===true;
  const accepted=testsPassed&&securityValidated&&compatibilityPassed&&authorityPreserved&&evidencePreserved;
  return Object.freeze({accepted,action:accepted?"migration-candidate":"block",productionReady:false,requiresReleaseControl:true});
}
