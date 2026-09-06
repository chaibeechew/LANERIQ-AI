import crypto from "node:crypto";
import {compileAppBuilderDesignIntent} from "./app-builder-design-intent.js";
import {rankAppBuilderTemplates} from "./app-builder-template-intelligence.js";
import {buildAppBuilderPageBlueprint} from "./app-builder-page-blueprint.js";
import {buildAdaptiveLayoutPlan} from "./app-builder-layout-engine.js";
import {composeAppBuilderComponents} from "./app-builder-component-composer.js";
import {createAppProductLifecycle} from "./app-builder-product-lifecycle.js";
import {createAppBuilderPlatformContract} from "./app-builder-platform-contract.js";
import {evaluateWorldClassAppQuality} from "./app-builder-world-class-quality.js";
import {createReleaseReadinessPlan,createPostLaunchLearningLoop} from "./app-builder-release-readiness.js";

export const APP_CREATION_INTELLIGENCE_VERSION="1.1.0";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function criticalFlows(intent){const goal=String(intent.primaryGoal||"");const flows=["onboarding","primary-navigation"];if(goal==="conversion")flows.push("discover-to-purchase");else if(goal==="lead-generation")flows.push("discover-to-qualified-inquiry");else if(goal==="booking")flows.push("discover-to-confirmed-booking");else if(goal==="operations")flows.push("work-queue-to-completion");else flows.push("discover-to-core-value");return flows;}

export function createWorldClassAppCreationPlan(prompt="",options={}){
  const intent=compileAppBuilderDesignIntent(prompt,options);
  const templateSelection=rankAppBuilderTemplates(intent,{limit:options.templateLimit||6});
  const pageBlueprint=buildAppBuilderPageBlueprint(intent,templateSelection);
  const layoutPlan=buildAdaptiveLayoutPlan(intent,pageBlueprint);
  const components=composeAppBuilderComponents(intent,pageBlueprint,layoutPlan);
  const flows=criticalFlows(intent);
  const lifecycle=createAppProductLifecycle({target:intent.target,mvp:options.mvp!==false,risk:options.risk||"medium",criticalFlows:flows});
  const platforms=options.platforms||["ios","android","web"];
  const platformContract=createAppBuilderPlatformContract({target:intent.target,platforms});
  const release=createReleaseReadinessPlan({target:intent.target,platforms,monetization:options.monetization||"unknown",locales:options.locales||[intent.locale]});
  const learning=createPostLaunchLearningLoop({primaryKpi:templateSelection?.selected?.archetypeId||intent.primaryGoal});
  const plan={
    version:APP_CREATION_INTELLIGENCE_VERSION,intent,templateSelection,pageBlueprint,layoutPlan,components,lifecycle,platformContract,release,learning,
    criticalFlows:Object.freeze(flows),
    execution:Object.freeze({
      order:Object.freeze(["opportunity-evidence","prd-and-scope","experience-architecture","template-ranking","page-blueprint","adaptive-layout","component-composition","prototype-validation","technical-architecture","vertical-slice-build","quality-engineering","real-device-and-browser-beta","release-readiness","progressive-launch","growth-loop"]),
      generateCodeOnlyAfterProductAndFlowContracts:true,prototypeBeforeScale:true,continuouslyRunnableVerticalSlices:true,securityAccessibilityPerformanceBuiltIn:true,featureFlagsAndRollbackBeforePublicRelease:true,projectMemoryUpdatedAfterValidatedLearning:true,
    }),
    truthBoundary:Object.freeze({generatedCodeDoesNotEqualWorkingProduct:true,ciDoesNotEqualLiveVerified:true,previewDoesNotEqualProduction:true,storeApprovalCannotBeGuaranteed:true,templateFitDoesNotReplaceUserValidation:true}),
  };
  return Object.freeze({...plan,planDigest:digest(plan)});
}

export function closeAppCreationPlan(plan,evidence={}){
  const quality=evaluateWorldClassAppQuality({...evidence,target:plan?.intent?.target||evidence.target});
  const releaseChecklistComplete=Boolean(evidence.releaseChecklistComplete);
  const humanReleaseApproval=Boolean(evidence.humanReleaseApproval);
  const releaseReady=quality.liveVerified&&releaseChecklistComplete&&humanReleaseApproval;
  return Object.freeze({
    planDigest:plan?.planDigest||null,quality,releaseReady,
    mayClaimLiveVerified:quality.liveVerified,
    mayClaimProduction:false,
    blockers:Object.freeze([!quality.machinePass&&"quality-thresholds",!quality.liveVerified&&"live-evidence",!releaseChecklistComplete&&"release-checklist",!humanReleaseApproval&&"human-release-approval"].filter(Boolean)),
  });
}
