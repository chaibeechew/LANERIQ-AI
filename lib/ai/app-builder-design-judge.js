export const APP_BUILDER_DESIGN_JUDGE_VERSION="1.0.0";

function result(id,passed,score,detail){return Object.freeze({id,passed:Boolean(passed),score:Math.max(0,Math.min(100,Math.round(score))),detail});}

export function judgeAppCreationPlan({intent,templateSelection,blueprint,layoutPlan,componentPlan}={}){
  const pages=blueprint?.informationArchitecture?.pages||[];
  const layoutPages=layoutPlan?.pages||[];
  const componentPages=componentPlan?.pages||[];
  const componentCount=componentPages.reduce((n,page)=>n+(page.components?.length||0),0);
  const allStates=pages.every(page=>["loading","empty","error","success"].every(state=>page.requiredStates?.includes(state)));
  const accessibility=componentPages.every(page=>page.components?.every(component=>component.accessibility?.keyboardOperable&&component.accessibility?.visibleFocus&&component.accessibility?.touchTargetMinimum>=44));
  const responsive=layoutPlan?.layoutPolicy?.reflowWithoutInformationLoss===true&&layoutPlan?.layoutPolicy?.horizontalPageScrollForbidden===true&&componentPages.every(page=>page.components?.every(component=>component.responsive?.preserveFunctionality));
  const checks=[
    result("intent-completeness",Boolean(intent?.industry&&intent?.archetypeId&&intent?.primaryGoal&&intent?.target),intent?100:0,"Business, product, target and design intent must be explicit."),
    result("template-originality",templateSelection?.directTemplateCloningAllowed===false&&templateSelection?.thirdPartyBrandPreservationAllowed===false,100,"Canonical templates are inspiration inputs, never direct third-party clones."),
    result("information-architecture",pages.length>=4&&new Set(pages.map(page=>page.route)).size===pages.length,pages.length>=4?100:70,"Use purposeful routes and avoid duplicate page architecture."),
    result("state-completeness",allStates,allStates?100:60,"Every page needs loading, empty, error and success states."),
    result("responsive-reflow",responsive,responsive?100:55,"Responsive composition must preserve information and functionality."),
    result("accessibility",accessibility,accessibility?100:50,"Interactive components require keyboard operation, visible focus and 44px targets."),
    result("component-composition",componentCount>=pages.length*3,componentCount>=pages.length*3?100:70,"Pages should be composed from reusable semantic components rather than one generic block."),
    result("authority-safety",componentPlan?.contracts?.serverAuthoritativeMutations===true&&componentPlan?.contracts?.aiMayAssistButNotEscalateAuthority===true,100,"AI assistance cannot replace authorization or server-side mutation authority."),
    result("liui-fit",layoutPlan?.livingIntelligence?.intentFirst===true&&layoutPlan?.livingIntelligence?.adaptiveBento===true,100,"LIUI is applied as contextual product behavior, not decoration."),
    result("privacy",intent?.rawPromptPersisted===false,100,"Design planning stores a digest rather than raw prompt evidence."),
  ];
  const score=Math.round(checks.reduce((sum,item)=>sum+item.score,0)/checks.length);
  const defects=checks.filter(check=>!check.passed).map(check=>Object.freeze({code:check.id,severity:check.score<60?"error":"warning",repair:check.detail}));
  const passed=checks.every(check=>check.passed)&&score>=95;
  return Object.freeze({
    version:APP_BUILDER_DESIGN_JUDGE_VERSION,
    score,
    target:95,
    passed,
    checks:Object.freeze(checks),
    defects:Object.freeze(defects),
    boundedRepairRounds:3,
    liveRuntimeVerified:false,
    productionClaimAllowed:false,
    evidenceClass:"CODE",
  });
}
