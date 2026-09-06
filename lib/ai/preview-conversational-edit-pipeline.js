import {createVisualEditContext} from "./visual-edit-context.js";
import {resolveVisualEditRegion} from "./visual-region-resolver.js";
import {classifyVisualEditIntent} from "./visual-edit-intent.js";
import {reconcileVisualEditAcrossDevices} from "./responsive-edit-reconciler.js";
import {evaluateEditSimplicity} from "./edit-simplicity-gate.js";
import {planSemanticVisualPatch} from "./visual-patch-planner.js";
import {judgeVisualEdit} from "./visual-edit-judge.js";

export const PREVIEW_CONVERSATIONAL_EDIT_PIPELINE_VERSION="1.0.0";

export function createPreviewConversationalEditPlan(input={}){
  const visualContext=createVisualEditContext(input.visual||{});
  const intent=classifyVisualEditIntent(input.instruction||"");
  const region=resolveVisualEditRegion(intent.originalInstruction,visualContext,input.pageModel||{});
  const responsive=reconcileVisualEditAcrossDevices(intent,region,{target:input.target||"app+website"});
  const simplicity=evaluateEditSimplicity(input.proposedComplexity||{});
  const patch=planSemanticVisualPatch({intent,region,responsive,context:visualContext,simplicityHint:simplicity.metrics});
  const verdict=judgeVisualEdit({region,intent,patch,responsive,simplicity,candidate:input.candidateChecks||{}});
  const executionAllowed=patch.modificationAllowed&&verdict.passed;
  const state=executionAllowed?"READY_FOR_EXISTING_MODIFY_API":patch.needsTargetConfirmation?"NEEDS_TARGET_SELECTION":intent.requiresExplicitConfirmation?"NEEDS_EXISTING_HIGH_RISK_CONFIRMATION":"PREVIEW_ONLY_REPAIR_REQUIRED";
  return Object.freeze({
    version:PREVIEW_CONVERSATIONAL_EDIT_PIPELINE_VERSION,state,executionAllowed,
    visualContext,intent,region,responsive,simplicity,patch,verdict,
    modifyEnvelope:executionAllowed?Object.freeze({
      instruction:patch.instruction,
      preciseTarget:patch.preciseTarget,
      visualEvidence:Object.freeze({screenshotDigest:visualContext.screenshotDigest,screenshotRef:visualContext.screenshotRef,rawScreenshotIncluded:false}),
      expectedVersionRequired:true,stableRequestIdRequired:true,
      authorizationSource:"existing-/api/modify-server-principal-only",
    }):null,
    userExperience:Object.freeze({normalUserInput:Object.freeze(["screenshot","one-sentence-or-voice"]),advancedControlsHiddenByDefault:true,showInternalAgents:false,showProviderConfig:false,showDatabaseConfig:false}),
    truthBoundary:Object.freeze({codeOrCiIsLiveVerified:false,screenshotIsAuthorization:false,previewIsProduction:false,existingModifySecurityMustRemainAuthoritative:true}),
  });
}
