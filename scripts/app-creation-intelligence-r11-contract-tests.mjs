import assert from "node:assert/strict";
import fs from "node:fs";
import { compileAppBuilderDesignIntent } from "../lib/ai/app-builder-design-intent.js";
import { rankAppBuilderTemplates } from "../lib/ai/app-builder-template-intelligence.js";
import { buildAppBuilderPageBlueprint } from "../lib/ai/app-builder-page-blueprint.js";
import { buildAdaptiveLayoutPlan } from "../lib/ai/app-builder-layout-engine.js";
import { composeAppBuilderComponents } from "../lib/ai/app-builder-component-composer.js";
import { judgeAppCreationPlan } from "../lib/ai/app-builder-design-judge.js";
import { createAppBuilderCreationPlan,closeAppBuilderCreationPlan,APP_BUILDER_CREATION_PHASES } from "../lib/ai/app-builder-creation-pipeline.js";
import { evaluateAppBuilderLiveVerification } from "../lib/ai/app-builder-live-verification.js";
import { APP_CREATION_INTELLIGENCE_AI_INSTRUCTION } from "../lib/ai/app-creation-intelligence-policy.js";
import { GENERATION_QUALITY_RULES } from "../lib/buildStandards.js";

const idea="Create an original futuristic glass Real Estate property listing directory as an App and Website for buyers and agents.";
const intent=compileAppBuilderDesignIntent(idea);
assert.equal(intent.industry,"Real Estate");
assert.equal(intent.archetypeId,"directory");
assert.equal(intent.styleId,"glass");
assert.equal(intent.target,"app+website");
assert.equal(intent.rawPromptPersisted,false);
assert.match(intent.promptDigest,/^[a-f0-9]{64}$/);
assert.doesNotMatch(JSON.stringify(intent),/buyers and agents/i,"Design intent evidence must not persist the raw customer prompt.");

const templates=rankAppBuilderTemplates(intent,{limit:6});
assert.equal(templates.templateCountEvaluated,3000);
assert.equal(templates.matches.length,6);
assert.equal(templates.selected.industry,"Real Estate");
assert.equal(templates.selected.archetypeId,"directory");
assert.equal(templates.selected.styleId,"glass");
assert.equal(templates.selected.applicationMode,"inspiration-only");
assert.equal(templates.directTemplateCloningAllowed,false);
assert.equal(templates.thirdPartyBrandPreservationAllowed,false);

const blueprint=buildAppBuilderPageBlueprint(intent,templates);
assert.ok(blueprint.informationArchitecture.pages.length>=4);
assert.equal(new Set(blueprint.informationArchitecture.pages.map(page=>page.route)).size,blueprint.informationArchitecture.pages.length);
assert.ok(blueprint.informationArchitecture.pages.every(page=>["loading","empty","error","success"].every(state=>page.requiredStates.includes(state))));
assert.equal(blueprint.experienceRules.reflowAt320CssPixels,true);
assert.equal(blueprint.experienceRules.noFunctionalityLossAcrossBreakpoints,true);

const layout=buildAdaptiveLayoutPlan(intent,blueprint);
assert.equal(layout.layoutPolicy.touchTargetMinimum,"44px");
assert.equal(layout.layoutPolicy.mobile.minWidth,320);
assert.equal(layout.layoutPolicy.reflowWithoutInformationLoss,true);
assert.equal(layout.layoutPolicy.horizontalPageScrollForbidden,true);
assert.equal(layout.layoutPolicy.visibleKeyboardFocusRequired,true);
assert.equal(layout.livingIntelligence.intentFirst,true);
assert.equal(layout.livingIntelligence.liquidIntelligenceGlass,"contextual-not-global");

const components=composeAppBuilderComponents(intent,blueprint,layout);
assert.equal(components.pages.length,blueprint.informationArchitecture.pages.length);
assert.ok(components.pages.every(page=>page.components.length>=4));
assert.ok(components.pages.every(page=>page.components.every(component=>component.accessibility.keyboardOperable&&component.accessibility.visibleFocus&&component.accessibility.touchTargetMinimum===44)));
assert.equal(components.contracts.serverAuthoritativeMutations,true);
assert.equal(components.contracts.aiMayAssistButNotEscalateAuthority,true);

const judged=judgeAppCreationPlan({intent,templateSelection:templates,blueprint,layoutPlan:layout,componentPlan:components});
assert.equal(judged.passed,true);
assert.ok(judged.score>=95);
assert.equal(judged.liveRuntimeVerified,false);
assert.equal(judged.productionClaimAllowed,false);
assert.equal(judged.evidenceClass,"CODE");

const plan=createAppBuilderCreationPlan(idea);
assert.deepEqual(APP_BUILDER_CREATION_PHASES,["DISCOVER","PLAN","COMPOSE","WIRE","VERIFY","PREVIEW","PUBLISH"]);
assert.equal(plan.generatorHandoff.ready,true);
assert.equal(plan.generatorHandoff.requireGeneratedExperienceStandard,true);
assert.equal(plan.generatorHandoff.requireGenerationOutcomeIntelligence,true);
assert.equal(plan.generatorHandoff.requireSelfHealBeforeAcceptance,true);
assert.equal(plan.publishEligibility.eligible,false);
assert.equal(plan.truthBoundary.codePlanIsNotLive,true);

const ciOnly=evaluateAppBuilderLiveVerification({ci:{exactHead:true,success:true}});
assert.equal(ciOnly.state,"CI_VERIFIED");
assert.equal(ciOnly.live,false);
assert.equal(ciOnly.productionClaimAllowed,false);
const sha="a".repeat(40);
const liveEvidence={
  gitSha:sha,deploymentSha:sha,runtimeSha:sha,deploymentTarget:"production",
  ci:{exactHead:true,success:true},
  browser:{home:true,plan:true,generate:true,preview:true,modify:true,save:true,publish:true},
  provider:{required:true,realRequest:true,success:true,mock:false,providerId:"external-provider",receiptDigest:"receipt-sha256"},
  database:{required:true,production:true,migrationsApplied:true,rlsVerified:true,writeReadVerified:true},
  accessibility:{keyboard:true,visibleFocus:true,reflow320:true,touchTargets:true,reducedMotion:true},
  runtime:{publicUrl:"https://example.test",publicUrlFetch:true,criticalConsoleErrors:0,criticalNetworkFailures:0},
  security:{appBuilderGate:true,authzBoundary:true,noSecretExposure:true,uploadsPresent:true,malwareGate:true},
  releaseControl:{passed:true,humanApproved:true},
};
const live=evaluateAppBuilderLiveVerification(liveEvidence);
assert.equal(live.state,"LIVE_VERIFIED");
assert.equal(live.live,true);
assert.equal(live.verified,true);
assert.equal(live.productionClaimAllowed,true);
const mocked=evaluateAppBuilderLiveVerification({...liveEvidence,provider:{...liveEvidence.provider,mock:true}});
assert.equal(mocked.state,"LIVE_NOT_VERIFIED");
assert.ok(mocked.missing.includes("provider"));
const closed=closeAppBuilderCreationPlan(plan,liveEvidence);
assert.equal(closed.publishEligibility.eligible,true);
assert.equal(closed.truthBoundary.productionClaimAllowed,true);

assert.match(APP_CREATION_INTELLIGENCE_AI_INSTRUCTION,/DISCOVER/);
assert.match(APP_CREATION_INTELLIGENCE_AI_INSTRUCTION,/TEMPLATE INTELLIGENCE/);
assert.match(APP_CREATION_INTELLIGENCE_AI_INSTRUCTION,/LIVE \+ VERIFIED/);
assert.match(GENERATION_QUALITY_RULES,/APP CREATION INTELLIGENCE — ROUND 11/);
assert.match(GENERATION_QUALITY_RULES,/exact SHA convergence/i);
const standards=fs.readFileSync("lib/buildStandards.js","utf8");
assert.match(standards,/APP_CREATION_INTELLIGENCE_AI_INSTRUCTION/);

console.log("✓ Round 11 compiles business/design intent without persisting the raw prompt");
console.log("✓ 3,000 canonical templates are ranked as inspiration and recomposed into purposeful page architecture");
console.log("✓ Adaptive layouts preserve 320px reflow, 44px touch targets, visible focus and LIUI behavior");
console.log("✓ Components carry state, responsive, data-binding and server-authorization contracts");
console.log("✓ Design Judge blocks false runtime/Production claims while validating creation quality at CODE level");
console.log("✓ LIVE + VERIFIED requires exact SHA + real browser/provider/database/runtime/security/Release Control evidence");
console.log("✓ Round 11 creation method is wired into the main LANERIQ generation quality instruction");
