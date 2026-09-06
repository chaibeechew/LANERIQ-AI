import crypto from "node:crypto";

export const VISUAL_EDIT_HISTORY_VERSION="1.0.0";
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value??null)).digest("hex");}

export function createVisualEditHistoryEntry({requestId,beforeVersionId,afterVersionId,beforeSpecification,afterSpecification,visualContext,patch,verdict}={}){
  return Object.freeze({
    version:VISUAL_EDIT_HISTORY_VERSION,
    requestId:String(requestId||"").slice(0,160)||null,
    beforeVersionId:String(beforeVersionId||"").slice(0,160)||null,
    afterVersionId:String(afterVersionId||"").slice(0,160)||null,
    beforeDigest:digest(beforeSpecification),afterDigest:digest(afterSpecification),
    screenshotDigest:visualContext?.screenshotDigest||null,
    editDigest:digest({operation:patch?.operation,verdict}),
    reversible:true,
    rollbackTargetVersionId:String(beforeVersionId||"").slice(0,160)||null,
    rawScreenshotPersisted:false,rawPromptPersisted:false,rawSpecificationPersistedInHistory:false,secretsPersisted:false,
  });
}

export function buildVisualEditRollbackRequest(entry={}){
  if(!entry?.rollbackTargetVersionId)throw new Error("LANERIQ_VISUAL_EDIT_ROLLBACK_TARGET_REQUIRED");
  return Object.freeze({targetVersionId:entry.rollbackTargetVersionId,reason:"visual-edit-rollback",requiresOwnershipCheck:true,requiresExpectedVersionCheck:true,authorityExpansionAllowed:false});
}
