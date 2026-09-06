export const APP_BUILDER_PAGE_BLUEPRINT_VERSION="1.0.0";

function slug(name,index){const value=String(name||`page-${index+1}`).toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");return value==="home"||index===0?"/":`/${value||`page-${index+1}`}`;}
function roleFor(name){const text=String(name||"").toLowerCase();if(/home|overview/.test(text))return"landing";if(/dashboard|metrics|reports|analytics/.test(text))return"command-center";if(/browse|catalog|directory|inventory|customers|leads|jobs|courses|groups/.test(text))return"collection";if(/detail|product|listing|lesson|profile/.test(text))return"detail";if(/booking|quote|checkout|submit|contact/.test(text))return"conversion";if(/settings|account/.test(text))return"settings";if(/messages|feed|events/.test(text))return"engagement";return"workflow";}
function sectionsFor(role,goal){const common={
  landing:["hero","trust-signal","primary-value","adaptive-bento","primary-cta"],
  "command-center":["context-header","kpi-strip","priority-work","adaptive-bento","recent-activity"],
  collection:["context-header","search-filter","result-summary","content-collection","empty-state"],
  detail:["context-header","primary-detail","supporting-facts","related-actions","related-content"],
  conversion:["context-header","progress","primary-form","confidence-panel","success-state"],
  settings:["context-header","preference-groups","permission-summary","save-state"],
  engagement:["context-header","primary-feed","quick-action","secondary-context","empty-state"],
  workflow:["context-header","primary-workflow","supporting-context","next-action","empty-state"],
};const sections=[...(common[role]||common.workflow)];if(goal==="lead-generation"&&role==="landing")sections.splice(-1,0,"lead-capture");if(goal==="booking"&&role==="landing")sections.splice(-1,0,"availability-preview");return sections;}

export function buildAppBuilderPageBlueprint(intent,templateSelection){
  if(!intent)throw new Error("LANERIQ_APP_BUILDER_DESIGN_INTENT_REQUIRED");
  const sourcePages=templateSelection?.selected?.pages||["Home","Workspace","Details","Settings"];
  const pages=sourcePages.map((name,index)=>{
    const role=roleFor(name);
    return Object.freeze({
      id:`page-${index+1}`,
      name,
      route:slug(name,index),
      role,
      purpose:`${role} page supporting ${intent.primaryGoal}`,
      sections:Object.freeze(sectionsFor(role,intent.primaryGoal)),
      requiredStates:Object.freeze(["loading","empty","error","success"]),
      responsiveBehavior:"preserve-information-and-actions-while-recomposing",
      primaryAction:role==="landing"?intent.primaryGoal:role==="conversion"?"complete-task":"continue-work",
    });
  });
  const navPages=pages.filter(page=>!["conversion"].includes(page.role)).slice(0,6);
  return Object.freeze({
    version:APP_BUILDER_PAGE_BLUEPRINT_VERSION,
    target:intent.target,
    informationArchitecture:Object.freeze({
      pages:Object.freeze(pages),
      navigation:Object.freeze(navPages.map(page=>Object.freeze({label:page.name,route:page.route}))),
      primaryGoal:intent.primaryGoal,
      maximumPrimaryNavItems:6,
      deepLinksRequired:true,
    }),
    experienceRules:Object.freeze({
      onePrimaryActionPerView:true,
      requiredStates:Object.freeze(["loading","empty","error","success"]),
      mobileFirst:true,
      reflowAt320CssPixels:true,
      noFunctionalityLossAcrossBreakpoints:true,
      templateIsInspirationNotCopy:true,
    }),
  });
}
