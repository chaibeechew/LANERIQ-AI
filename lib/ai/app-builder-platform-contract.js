export const APP_BUILDER_PLATFORM_CONTRACT_VERSION="1.0.0";

export function createAppBuilderPlatformContract({target="app+website",platforms=["ios","android","web"]}={}){
  const selected=[...new Set((platforms||[]).map(String).filter(Boolean))];
  const contract={
    version:APP_BUILDER_PLATFORM_CONTRACT_VERSION,target:String(target),platforms:Object.freeze(selected),
    universal:Object.freeze({visualHierarchy:true,platformConsistency:true,progressiveDisclosure:true,emptyLoadingErrorSuccessStates:true,semanticMotion:true,reducedMotion:true,internationalization:true,rtl:true,accessibilityByDesign:true}),
    ios:selected.includes("ios")?Object.freeze({safeAreas:true,dynamicType:true,systemNavigationConventions:true,orientationAdaptation:true,resizableWindowAwareness:true,controlsDistinctFromContent:true,fullWidthPrimaryButtonsAvoidedUnlessJustified:true}):null,
    android:selected.includes("android")?Object.freeze({material3:true,adaptiveWindowClasses:true,largeScreenAndFoldableAware:true,backNavigationPredictable:true,dynamicColorAccessibleWhenUsed:true,technicalQualityGate:true,deviceMigrationReadiness:true}):null,
    web:selected.includes("web")?Object.freeze({semanticHtml:true,keyboardOperable:true,visibleFocus:true,wcag22AATarget:true,responsiveReflow:true,coreWebVitalsFieldMeasurement:true,lcpMsP75Target:2500,inpMsP75Target:200,clsP75Target:0.1}):null,
    rules:Object.freeze({platformConventionBeforeNovelty:true,contentAndTaskBeforeDecoration:true,noFunctionalityLossAcrossSizes:true,noAccessibilityRegressionForConversion:true,noDarkPatterns:true}),
  };
  return Object.freeze(contract);
}
