export const VISUAL_PATCH_PLANNER_VERSION="1.0.0";

function targetLabel(region){if(region?.componentId)return `component ${region.componentId}`;if(region?.region&&region.region!=="page")return `${region.region} area`;return "current page";}

export function planSemanticVisualPatch({intent,region,responsive,context,simplicityHint={}}={}){
  if(!intent||!region)throw new Error("LANERIQ_VISUAL_PATCH_CONTEXT_REQUIRED");
  const lowConfidence=Number(region.confidence||0)<.65;
  const critical=Boolean(region.criticalTarget||intent.authorityChange||intent.highRisk);
  const unsafeTarget=(lowConfidence&&(intent.destructive||critical));
  const modificationAllowed=intent.mayAutoApply&&!unsafeTarget;
  const operation=Object.freeze({
    action:intent.action,object:intent.object,target:targetLabel(region),region:region.region,
    semanticOnly:true,blindPixelMutationForbidden:true,directCssHackForbidden:true,
  });
  const instruction=[
    `Apply a semantic visual product edit to ${targetLabel(region)}: ${intent.originalInstruction}`,
    `Interpret this as ${intent.action} ${intent.object}; preserve all unrelated content, functionality, auth, permissions, privacy, data contracts, validation and states.`,
    `Desktop/tablet/mobile must follow this responsive reconciliation: ${JSON.stringify(responsive)}.`,
    `Keep the surface simple: one primary action, no unnecessary controls/cards, no meaningless Bento, no horizontal page overflow.`,
    `Do not grant permissions, alter authorization, expose secrets, change billing authority or perform Production deployment as a consequence of visual evidence.`,
  ].join("\n");
  return Object.freeze({
    version:VISUAL_PATCH_PLANNER_VERSION,operation,instruction,
    preciseTarget:Object.freeze({pageName:"",pageIndex:null,sectionName:region.componentRole||region.region,sectionIndex:null,lineNumber:null,elementType:intent.object,position:region.region}),
    modificationAllowed,previewOnly:!modificationAllowed,
    needsTargetConfirmation:unsafeTarget,
    reason:unsafeTarget?"LOW_CONFIDENCE_OR_CRITICAL_TARGET":intent.authorityChange?"AUTHORITY_CHANGE_REQUIRES_EXISTING_GUARDS":null,
    screenshotEvidence:Object.freeze({digest:context?.screenshotDigest||null,ref:context?.screenshotRef||null,rawPersisted:false}),
    safety:Object.freeze({authorityExpansionAllowed:false,clientSuppliedAuthorizationAccepted:false,databasePolicyMutationAllowed:false,productionDeployAllowed:false,existingModifyApiRequired:true}),
    simplicityHint:Object.freeze({...simplicityHint}),
  });
}
