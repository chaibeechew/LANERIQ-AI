import crypto from "node:crypto";

export const LANERIQ_SKILL_SYNTHESIS_VERSION="0.1.0";

function text(value,max=1200){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

const HIGH_RISK_CAPABILITIES=new Set(["production-write","database-destructive","financial-transfer","credential-management","security-policy-write","admin-permission"]);

export function createSynthesizedSkillManifest(input={}){
  const id=text(input.id||`skill-${Date.now()}`,120);const purpose=text(input.purpose,800);
  if(!id||!purpose)throw new Error("LANERIQ_SYNTHESIZED_SKILL_ID_AND_PURPOSE_REQUIRED");
  const capabilities=(Array.isArray(input.capabilities)?input.capabilities:[]).slice(0,30).map(v=>text(v,120)).filter(Boolean);
  const highRisk=capabilities.some(cap=>HIGH_RISK_CAPABILITIES.has(cap));
  const manifest={
    schemaVersion:"1",
    id,purpose,
    capabilities,
    inputs:(Array.isArray(input.inputs)?input.inputs:[]).slice(0,30).map(v=>text(v,120)),
    outputs:(Array.isArray(input.outputs)?input.outputs:[]).slice(0,30).map(v=>text(v,120)),
    dependencies:(Array.isArray(input.dependencies)?input.dependencies:[]).slice(0,30).map(v=>text(v,160)),
    networkRequired:input.networkRequired===true,
    filesystemWriteRequired:input.filesystemWriteRequired===true,
    externalSideEffects:input.externalSideEffects===true,
    highRisk,
    ttlRuns:Math.max(1,Math.min(100,Math.round(Number(input.ttlRuns)||10))),
  };
  return freeze({...manifest,manifestDigest:digest(manifest),ephemeralByDefault:true});
}

export function planSkillValidation(input={}){
  const manifest=input.manifest?.manifestDigest?input.manifest:createSynthesizedSkillManifest(input.manifest||input);
  return freeze({
    version:LANERIQ_SKILL_SYNTHESIS_VERSION,
    manifest,
    sandboxRequired:true,
    staticInspectionRequired:true,
    dependencyPolicyCheckRequired:true,
    unitTestsRequired:true,
    adversarialInputsRequired:true,
    outputSchemaValidationRequired:true,
    networkDefaultDeny:!manifest.networkRequired,
    humanApprovalRequired:manifest.highRisk||manifest.externalSideEffects,
    installGloballyAllowed:false,
    executeBeforeValidationAllowed:false,
    maySelfGrantPermissions:false,
    lifecycle:Object.freeze(["draft","sandbox-validate","adversarial-test","approve-if-required","ephemeral-use","observe","retire-or-promote-through-release-control"]),
  });
}

export function evaluateSynthesizedSkill(input={}){
  const checks={
    staticInspectionPassed:input.staticInspectionPassed===true,
    dependencyPolicyPassed:input.dependencyPolicyPassed===true,
    unitTestsPassed:input.unitTestsPassed===true,
    adversarialTestsPassed:input.adversarialTestsPassed===true,
    outputValidationPassed:input.outputValidationPassed===true,
    sandboxEscapeDetected:input.sandboxEscapeDetected!==true,
    permissionEscalationDetected:input.permissionEscalationDetected!==true,
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return freeze({version:LANERIQ_SKILL_SYNTHESIS_VERSION,acceptedForEphemeralUse:failed.length===0,failed,checks,mayPromoteToPlatformSkill:false,promotionRequiresIndependentReview:true});
}
