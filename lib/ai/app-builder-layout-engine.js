export const APP_BUILDER_LAYOUT_ENGINE_VERSION="1.0.0";

const FAMILY={
  landing:"immersive-hero-adaptive-bento",
  "command-center":"command-grid-priority-rail",
  collection:"search-filter-responsive-collection",
  detail:"focused-detail-context-rail",
  conversion:"focused-step-flow",
  settings:"grouped-preferences",
  engagement:"feed-context-composer",
  workflow:"task-context-workspace",
};

function sectionLayout(section){
  if(/hero/.test(section))return"hero-split-or-stack";
  if(/bento|kpi/.test(section))return"adaptive-bento";
  if(/collection|feed|related-content/.test(section))return"responsive-grid-or-list";
  if(/form|capture|progress/.test(section))return"focused-form-flow";
  if(/filter/.test(section))return"toolbar-to-sheet";
  if(/detail|facts|context/.test(section))return"content-with-context";
  return"semantic-stack";
}

export function buildAdaptiveLayoutPlan(intent,blueprint){
  const pages=blueprint?.informationArchitecture?.pages||[];
  return Object.freeze({
    version:APP_BUILDER_LAYOUT_ENGINE_VERSION,
    designSystem:intent?.designSystem,
    layoutPolicy:Object.freeze({
      contentMaxWidth:"1280px",
      readableTextMaxWidth:"72ch",
      touchTargetMinimum:"44px",
      spacingScale:Object.freeze([4,8,12,16,24,32,48,64]),
      mobile:Object.freeze({minWidth:320,columns:1,navigation:"bottom-or-collapsed",stackPriority:"primary-action-first"}),
      tablet:Object.freeze({minWidth:768,columns:"1-2",navigation:"adaptive"}),
      desktop:Object.freeze({minWidth:1200,columns:"1-4-by-content-role",navigation:"persistent-when-useful"}),
      reflowWithoutInformationLoss:true,
      horizontalPageScrollForbidden:true,
      reducedMotionFallbackRequired:true,
      visibleKeyboardFocusRequired:true,
    }),
    pages:Object.freeze(pages.map(page=>Object.freeze({
      pageId:page.id,
      route:page.route,
      role:page.role,
      family:FAMILY[page.role]||FAMILY.workflow,
      sections:Object.freeze(page.sections.map((section,index)=>Object.freeze({
        id:`${page.id}-section-${index+1}`,
        role:section,
        layout:sectionLayout(section),
        priority:index===0?"primary":index<3?"high":"supporting",
        desktop:index===0&&page.role==="landing"?"12-column-hero":"12-column-fluid",
        tablet:"8-column-adaptive",
        mobile:"single-column-reflow",
      }))),
      stickyActionAllowed:["conversion","detail"].includes(page.role),
      twoDimensionalOverflowAllowedOnlyFor:Object.freeze(["data-table","map","diagram","timeline-canvas"]),
    }))),
    livingIntelligence:Object.freeze({adaptiveBento:true,livingCards:true,liquidIntelligenceGlass:"contextual-not-global",semanticMotion:true,intentFirst:true}),
  });
}
