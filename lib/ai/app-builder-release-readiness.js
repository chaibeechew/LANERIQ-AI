export const APP_RELEASE_READINESS_VERSION="1.0.0";

export function createReleaseReadinessPlan({target="app+website",platforms=["ios","android","web"],monetization="unknown",locales=["auto"]}={}){
  const selected=[...new Set((platforms||[]).map(String).filter(Boolean))];
  const tasks=[];
  if(selected.includes("ios")) tasks.push("app-store-record","app-icon","screenshots-and-previews","accurate-metadata","privacy-disclosures","review-access","iap-validation-if-used","crash-and-bug-check","localized-product-page");
  if(selected.includes("android")) tasks.push("play-console-record","aab-build","store-listing-assets","data-safety","policy-review","technical-quality-check","adaptive-device-check","device-migration-check","staged-rollout-plan");
  if(selected.includes("web")) tasks.push("production-domain","https","seo-metadata","structured-data-where-valid","sitemap-and-robots","wcag-2.2-aa-review","core-web-vitals-field-plan","analytics-consent","rollback-plan");
  tasks.push("support-contact","release-notes","incident-playbook","feature-flags","monitoring-alerts","post-release-health-check");
  return Object.freeze({version:APP_RELEASE_READINESS_VERSION,target:String(target),platforms:Object.freeze(selected),monetization:String(monetization),locales:Object.freeze([...locales].map(String)),tasks:Object.freeze([...new Set(tasks)]),rollout:Object.freeze({progressive:true,canaryFirst:true,rollbackRequired:true,healthMetricsRequired:true}),storeOptimization:Object.freeze({assetExperimentationRecommended:true,audienceSpecificProductPagesRecommended:true,conversionAndDownstreamValueMeasured:true}),humanReviewRequiredBeforePublicRelease:true});
}

export function createPostLaunchLearningLoop({primaryKpi="activation",guardrails=["crash-free","latency","retention","support-load"]}={}){
  return Object.freeze({version:APP_RELEASE_READINESS_VERSION,primaryKpi:String(primaryKpi),guardrails:Object.freeze([...guardrails].map(String)),loop:Object.freeze(["observe","diagnose","form-hypothesis","design-smallest-test","ship-behind-flag","measure","keep-or-rollback","update-product-memory"]),rules:Object.freeze({onePrimaryOutcomePerExperiment:true,noDarkPatterns:true,doNotTradeSafetyPrivacyAccessibilityForConversion:true,statisticalAndPracticalSignificanceRequired:true})});
}
