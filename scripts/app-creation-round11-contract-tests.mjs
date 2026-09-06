import assert from "node:assert/strict";
import {compileAppBuilderDesignIntent} from "../lib/ai/app-builder-design-intent.js";
import {rankAppBuilderTemplates} from "../lib/ai/app-builder-template-intelligence.js";
import {buildAppBuilderPageBlueprint} from "../lib/ai/app-builder-page-blueprint.js";
import {buildAdaptiveLayoutPlan} from "../lib/ai/app-builder-layout-engine.js";
import {composeAppBuilderComponents} from "../lib/ai/app-builder-component-composer.js";
import {createAppProductLifecycle,APP_PRODUCT_PHASES} from "../lib/ai/app-builder-product-lifecycle.js";
import {createAppBuilderPlatformContract} from "../lib/ai/app-builder-platform-contract.js";
import {evaluateWorldClassAppQuality} from "../lib/ai/app-builder-world-class-quality.js";
import {createReleaseReadinessPlan,createPostLaunchLearningLoop} from "../lib/ai/app-builder-release-readiness.js";
import {createWorldClassAppCreationPlan,closeAppCreationPlan} from "../lib/ai/app-creation-intelligence.js";

const intent=compileAppBuilderDesignIntent("Create a premium real estate app and website for buyers to search properties, save favorites and send qualified inquiries",{locale:"en-MY"});
assert.equal(intent.industry,"Real Estate");
assert.equal(intent.archetypeId,"directory");
assert.equal(intent.target,"app+website");
assert.equal(intent.rawPromptPersisted,false);

const ranked=rankAppBuilderTemplates(intent,{limit:6});
assert.ok(ranked.matches.length>=1);
assert.equal(ranked.directTemplateCloningAllowed,false);

const blueprint=buildAppBuilderPageBlueprint(intent,ranked);
assert.ok(blueprint.informationArchitecture.pages.length>=1);
assert.equal(blueprint.experienceRules.noFunctionalityLossAcrossBreakpoints,true);

const layout=buildAdaptiveLayoutPlan(intent,blueprint);
assert.equal(layout.layoutPolicy.reflowWithoutInformationLoss,true);
assert.equal(layout.layoutPolicy.visibleKeyboardFocusRequired,true);

const components=composeAppBuilderComponents(intent,blueprint,layout);
assert.ok(components.pages.length>=1);
assert.equal(components.contracts.serverAuthoritativeMutations,true);
assert.equal(components.contracts.aiMayAssistButNotEscalateAuthority,true);

const lifecycle=createAppProductLifecycle({target:intent.target,criticalFlows:["search-to-inquiry"]});
assert.equal(APP_PRODUCT_PHASES.length,12);
assert.equal(lifecycle.phases[0].id,"opportunity");
assert.equal(lifecycle.phases.at(-1).id,"growth-and-evolution");
assert.equal(lifecycle.principles.evidenceDrivenIteration,true);

const platform=createAppBuilderPlatformContract({target:intent.target,platforms:["ios","android","web"]});
assert.equal(platform.ios.safeAreas,true);
assert.equal(platform.android.material3,true);
assert.equal(platform.web.wcag22AATarget,true);
assert.equal(platform.web.lcpMsP75Target,2500);
assert.equal(platform.rules.noDarkPatterns,true);

const release=createReleaseReadinessPlan({target:"app+website",platforms:["ios","android","web"]});
for(const task of ["app-store-record","aab-build","wcag-2.2-aa-review","rollback-plan"]) assert.ok(release.tasks.includes(task));
assert.equal(release.humanReviewRequiredBeforePublicRelease,true);

const learning=createPostLaunchLearningLoop({primaryKpi:"qualified-inquiry"});
assert.ok(learning.loop.includes("keep-or-rollback"));
assert.equal(learning.rules.noDarkPatterns,true);

const ciLike={target:"app+website",productValue:1,criticalFlowCompletion:1,usability:1,accessibility:1,security:1,reliability:1,storeReadiness:1,observability:1,web:{lcpMsP75:1800,inpMsP75:120,clsP75:0.04}};
const incomplete=evaluateWorldClassAppQuality(ciLike);
assert.equal(incomplete.machinePass,true);
assert.equal(incomplete.liveVerified,false,"CI-like scores must not become LIVE without real evidence");

const fullEvidence={...ciLike,realDeviceVerified:true,realBrowserVerified:true,storeMetadataVerified:true,privacyDisclosuresVerified:true,rollbackVerified:true,releaseChecklistComplete:true,humanReleaseApproval:true};
const quality=evaluateWorldClassAppQuality(fullEvidence);
assert.equal(quality.liveVerified,true);
assert.equal(quality.productionClaimAllowed,false);

const plan=createWorldClassAppCreationPlan("Build a modern real estate app and website with property search, favorites and inquiry",{locale:"en-MY"});
assert.equal(plan.lifecycle.phases.length,12);
assert.ok(plan.templateSelection.selected);
assert.ok(plan.pageBlueprint.informationArchitecture.pages.length>=1);
assert.ok(plan.components.pages.length>=1);
assert.equal(plan.execution.generateCodeOnlyAfterProductAndFlowContracts,true);
assert.equal(plan.execution.prototypeBeforeScale,true);
assert.equal(plan.truthBoundary.previewDoesNotEqualProduction,true);
assert.equal(plan.intent.rawPromptPersisted,false);

const closed=closeAppCreationPlan(plan,fullEvidence);
assert.equal(closed.releaseReady,true);
assert.equal(closed.mayClaimProduction,false);
assert.deepEqual(closed.blockers,[]);

const blocked=closeAppCreationPlan(plan,{...fullEvidence,humanReleaseApproval:false});
assert.equal(blocked.releaseReady,false);
assert.ok(blocked.blockers.includes("human-release-approval"));

console.log("Round 11 App Creation Intelligence contracts: PASS");
