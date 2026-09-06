import { compileAppBuilderDesignIntent } from "./app-builder-design-intent.js";
import { rankAppBuilderTemplates } from "./app-builder-template-intelligence.js";
import { buildAppBuilderPageBlueprint } from "./app-builder-page-blueprint.js";
import { buildAdaptiveLayoutPlan } from "./app-builder-layout-engine.js";
import { composeAppBuilderComponents } from "./app-builder-component-composer.js";
import { judgeAppCreationPlan } from "./app-builder-design-judge.js";
import { evaluateAppBuilderLiveVerification } from "./app-builder-live-verification.js";

export const APP_BUILDER_CREATION_PIPELINE_VERSION="1.0.0";
export const APP_BUILDER_CREATION_PHASES=Object.freeze(["DISCOVER","PLAN","COMPOSE","WIRE","VERIFY","PREVIEW","PUBLISH"]);

export function createAppBuilderCreationPlan(prompt="",options={}){
  const intent=compileAppBuilderDesignIntent(prompt,options);
  const templates=rankAppBuilderTemplates(intent,{limit:options.templateLimit||6});
  const blueprint=buildAppBuilderPageBlueprint(intent,templates);
  const layout=buildAdaptiveLayoutPlan(intent,blueprint);
  const components=composeAppBuilderComponents(intent,blueprint,layout);
  const designJudge=judgeAppCreationPlan({intent,templateSelection:templates,blueprint,layoutPlan:layout,componentPlan:components});
  const phaseStatus=Object.freeze({
    DISCOVER:"complete",
    PLAN:designJudge.passed?"complete":"repair-required",
    COMPOSE:designJudge.passed?"complete":"blocked",
    WIRE:"runtime-required",
    VERIFY:"runtime-required",
    PREVIEW:"deployment-required",
    PUBLISH:"release-control-required",
  });
  return Object.freeze({
    version:APP_BUILDER_CREATION_PIPELINE_VERSION,
    phases:APP_BUILDER_CREATION_PHASES,
    phaseStatus,
    intent,
    templateIntelligence:templates,
    pageBlueprint:blueprint,
    layoutPlan:layout,
    componentPlan:components,
    designJudge,
    generatorHandoff:Object.freeze({
      ready:designJudge.passed,
      templateMode:"inspiration-only",
      preserveBusinessLogicDuringVisualRepair:true,
      requireGeneratedExperienceStandard:true,
      requireGenerationOutcomeIntelligence:true,
      requireSelfHealBeforeAcceptance:true,
      requireServerAuthorizationForMutations:true,
    }),
    publishEligibility:Object.freeze({eligible:false,reason:"Real runtime, deployment and Production evidence are required after generation."}),
    truthBoundary:Object.freeze({codePlanIsNotLive:true,previewIsNotProduction:true,ciIsNotRuntimeVerification:true,productionClaimAllowed:false}),
  });
}

export function closeAppBuilderCreationPlan(plan,evidence={}){
  const liveVerification=evaluateAppBuilderLiveVerification(evidence);
  return Object.freeze({
    ...plan,
    liveVerification,
    publishEligibility:Object.freeze({eligible:liveVerification.state==="LIVE_VERIFIED",reason:liveVerification.state==="LIVE_VERIFIED"?"Production evidence gate passed.":`Blocked: ${liveVerification.missing.join(", ")||liveVerification.state}`}),
    truthBoundary:Object.freeze({...plan.truthBoundary,productionClaimAllowed:liveVerification.productionClaimAllowed}),
  });
}
