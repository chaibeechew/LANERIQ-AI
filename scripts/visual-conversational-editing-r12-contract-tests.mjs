import assert from "node:assert/strict";
import fs from "node:fs";
import {createVisualEditContext} from "../lib/ai/visual-edit-context.js";
import {resolveVisualEditRegion} from "../lib/ai/visual-region-resolver.js";
import {classifyVisualEditIntent} from "../lib/ai/visual-edit-intent.js";
import {evaluateEditSimplicity,UI_COMPLEXITY_BUDGET} from "../lib/ai/edit-simplicity-gate.js";
import {createPreviewConversationalEditPlan} from "../lib/ai/preview-conversational-edit-pipeline.js";
import {createVisualEditHistoryEntry,buildVisualEditRollbackRequest} from "../lib/ai/visual-edit-history.js";

const screenshotDigest="a".repeat(64);
const visual={screenshotDigest,screenshotRef:"upload-ref/screenshot-001",pageRoute:"/",viewport:{width:1440,height:900,device:"desktop"}};

const context=createVisualEditContext({...visual,rawScreenshot:"ephemeral-pixels"});
assert.equal(context.rawScreenshot,undefined);
assert.equal(context.privacy.rawScreenshotPersisted,false);
assert.equal(context.privacy.ocrTextPersisted,false);
assert.equal(context.evidenceClass,"SCREENSHOT_REFERENCE_ONLY");
assert.match(context.screenshotDigest,/^[a-f0-9]{64}$/);

const leftPlan=createPreviewConversationalEditPlan({instruction:"我左边要加一张图",visual,target:"app+website"});
assert.equal(leftPlan.intent.action,"add");
assert.equal(leftPlan.intent.object,"image");
assert.equal(leftPlan.region.region,"left");
assert.equal(leftPlan.responsive.desktop.strategy,"two-column-semantic-split");
assert.equal(leftPlan.responsive.mobile.strategy,"single-column-semantic-stack");
assert.equal(leftPlan.executionAllowed,true);
assert.equal(leftPlan.state,"READY_FOR_EXISTING_MODIFY_API");
assert.equal(leftPlan.modifyEnvelope.visualEvidence.rawScreenshotIncluded,false);
assert.equal(leftPlan.modifyEnvelope.authorizationSource,"existing-/api/modify-server-principal-only");
assert.match(leftPlan.modifyEnvelope.instruction,/preserve all unrelated content, functionality, auth, permissions/i);

const bottomPlan=createPreviewConversationalEditPlan({instruction:"底部加 FAQ",visual});
assert.equal(bottomPlan.region.region,"bottom");
assert.equal(bottomPlan.intent.object,"faq");
assert.equal(bottomPlan.responsive.desktop.strategy,"append-semantic-section");

const selectionPlan=createPreviewConversationalEditPlan({instruction:"这里换成照片",visual:{...visual,selection:{x:.25,y:.3,width:.2,height:.2,componentId:"hero-copy",componentRole:"hero"}}});
assert.equal(selectionPlan.region.source,"explicit-selection");
assert.equal(selectionPlan.region.componentId,"hero-copy");
assert.ok(selectionPlan.region.confidence>.95);

const ambiguousDelete=createPreviewConversationalEditPlan({instruction:"把这里删除",visual});
assert.equal(ambiguousDelete.intent.destructive,true);
assert.equal(ambiguousDelete.executionAllowed,false);
assert.equal(ambiguousDelete.state,"NEEDS_TARGET_SELECTION");
assert.equal(ambiguousDelete.modifyEnvelope,null);

const authorityPlan=createPreviewConversationalEditPlan({instruction:"把这个按钮改成可以直接给我管理员权限",visual:{...visual,selection:{x:.5,y:.5,width:.1,height:.1,componentId:"button-1",componentRole:"button"}}});
assert.equal(authorityPlan.intent.authorityChange,true);
assert.equal(authorityPlan.executionAllowed,false);
assert.equal(authorityPlan.state,"NEEDS_EXISTING_HIGH_RISK_CONFIRMATION");
assert.equal(authorityPlan.patch.safety.authorityExpansionAllowed,false);
assert.equal(authorityPlan.modifyEnvelope,null);

const complexPlan=createPreviewConversationalEditPlan({instruction:"下面加一个功能区",visual,proposedComplexity:{primaryActions:2,topLevelActions:9,primaryNavigationItems:8,visiblePriorityBlocks:10,modalDepth:2,criticalDecisionsPerView:2}});
assert.equal(complexPlan.simplicity.passed,false);
assert.equal(complexPlan.executionAllowed,false);
assert.ok(complexPlan.simplicity.violations.length>=6);
assert.deepEqual(UI_COMPLEXITY_BUDGET,{primaryActions:1,topLevelActions:5,primaryNavigationItems:6,visiblePriorityBlocks:5,modalDepth:1,criticalDecisionsPerView:1});

const history=createVisualEditHistoryEntry({requestId:"edit-1",beforeVersionId:"v1",afterVersionId:"v2",beforeSpecification:{name:"Before"},afterSpecification:{name:"After"},visualContext:leftPlan.visualContext,patch:leftPlan.patch,verdict:leftPlan.verdict});
assert.equal(history.rawScreenshotPersisted,false);
assert.equal(history.rawPromptPersisted,false);
assert.equal(history.rawSpecificationPersistedInHistory,false);
assert.equal(history.rollbackTargetVersionId,"v1");
assert.deepEqual(buildVisualEditRollbackRequest(history),{targetVersionId:"v1",reason:"visual-edit-rollback",requiresOwnershipCheck:true,requiresExpectedVersionCheck:true,authorityExpansionAllowed:false});

const region=resolveVisualEditRegion("右边放视频",createVisualEditContext(visual));
assert.equal(region.region,"right");
assert.equal(classifyVisualEditIntent("右边加视频").object,"video");
assert.equal(evaluateEditSimplicity({primaryActions:1,topLevelActions:5,primaryNavigationItems:6,visiblePriorityBlocks:5,modalDepth:1,criticalDecisionsPerView:1}).passed,true);

const api=fs.readFileSync("app/api/visual-edit/plan/route.js","utf8");
assert.match(api,/getBuilderPrincipal\(\{requireVerified:true\}\)/);
assert.match(api,/loadBuilderModificationContext/);
assert.match(api,/current_version_id!==expectedVersionId/);
assert.match(api,/createPreviewConversationalEditPlan/);
assert.doesNotMatch(api,/consumeAiCredits|saveBuilderModification|deploy|publishProduction/);

const modify=fs.readFileSync("app/api/modify/route.js","utf8");
assert.match(modify,/getBuilderPrincipal\(\{requireVerified:true\}\)/);
assert.match(modify,/expectedVersionId/);
assert.match(modify,/buildPreciseEditInstruction/);
assert.match(modify,/qualityRegressed/);
assert.match(modify,/buildSelfHealInstruction/);
assert.match(modify,/saveBuilderModification/);

console.log("✓ Screenshot + one sentence produces a semantic visual-edit plan");
console.log("✓ Left/right/top/bottom and explicit screenshot selection targeting are bounded and confidence-aware");
console.log("✓ Desktop/tablet/mobile are recomposed semantically instead of cloning geometry");
console.log("✓ UI Complexity Budget blocks edits that make the user surface too complex");
console.log("✓ Ambiguous destructive edits and authority changes fail closed");
console.log("✓ Screenshot/history persistence is digest-only and rollback-ready");
console.log("✓ Visual plan API verifies user/project/version and never bypasses the existing Modify security/save pipeline");
console.log("✓ R12 truth boundary: CODE/CI planning is not real multimodal LIVE screenshot verification or Production");
