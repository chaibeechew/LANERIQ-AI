export const APP_BUILDER_COMPONENT_COMPOSER_VERSION="1.0.0";

const COMPONENTS={
  "hero":"IntentHero","trust-signal":"TrustStrip","primary-value":"ValueGrid","adaptive-bento":"LivingBento","primary-cta":"PrimaryAction",
  "context-header":"ContextHeader","kpi-strip":"MetricStrip","priority-work":"PriorityQueue","recent-activity":"ActivityTimeline",
  "search-filter":"SearchFilterBar","result-summary":"ResultSummary","content-collection":"AdaptiveCollection","empty-state":"EmptyState",
  "primary-detail":"DetailPanel","supporting-facts":"FactGrid","related-actions":"ActionRail","related-content":"RelatedCollection",
  "progress":"ProgressStepper","primary-form":"ValidatedForm","confidence-panel":"TrustPanel","success-state":"SuccessState","lead-capture":"LeadCapture","availability-preview":"AvailabilityPreview",
  "preference-groups":"PreferenceGroups","permission-summary":"PermissionSummary","save-state":"SaveState",
  "primary-feed":"ActivityFeed","quick-action":"QuickComposer","secondary-context":"ContextRail",
  "primary-workflow":"WorkflowCanvas","supporting-context":"ContextRail","next-action":"NextBestAction",
};
function componentFor(role){return COMPONENTS[role]||"SemanticSection";}
function interactionFor(role){if(/form|capture/.test(role))return"validate-submit-confirm";if(/search|filter/.test(role))return"query-filter-clear";if(/collection|feed/.test(role))return"browse-open-paginate";if(/cta|action|next/.test(role))return"single-primary-action";return"read-navigate";}
function dataFor(role){if(/kpi|metric/.test(role))return"aggregate-read-model";if(/collection|feed|activity|related/.test(role))return"collection-read-model";if(/form|capture/.test(role))return"validated-mutation";if(/permission/.test(role))return"authorization-summary";return"page-context";}

export function composeAppBuilderComponents(intent,blueprint,layoutPlan){
  const pageMap=new Map((blueprint?.informationArchitecture?.pages||[]).map(page=>[page.id,page]));
  const pages=(layoutPlan?.pages||[]).map(layoutPage=>{
    const page=pageMap.get(layoutPage.pageId);
    const components=layoutPage.sections.map((section,index)=>Object.freeze({
      id:`${layoutPage.pageId}-component-${index+1}`,
      type:componentFor(section.role),
      role:section.role,
      slot:section.id,
      interaction:interactionFor(section.role),
      dataBinding:dataFor(section.role),
      authorization:"inherit-page-and-resource-policy",
      serverMutationRequired:/validated-mutation/.test(dataFor(section.role)),
      states:Object.freeze(["loading","empty","error","ready"]),
      accessibility:Object.freeze({semanticRoleRequired:true,keyboardOperable:true,visibleFocus:true,labelRequired:true,touchTargetMinimum:44}),
      responsive:Object.freeze({mobile:"reflow",tablet:"adaptive",desktop:"full",preserveFunctionality:true}),
      aiBehavior:/NextBestAction|LivingBento|QuickComposer/.test(componentFor(section.role))?"assistive-never-authority":"none",
    }));
    return Object.freeze({pageId:layoutPage.pageId,route:layoutPage.route,role:page?.role||layoutPage.role,components:Object.freeze(components)});
  });
  return Object.freeze({
    version:APP_BUILDER_COMPONENT_COMPOSER_VERSION,
    target:intent?.target,
    pages:Object.freeze(pages),
    contracts:Object.freeze({
      reusableComponents:true,
      serverAuthoritativeMutations:true,
      leastPrivilegeDataBinding:true,
      rawSecretsInClientForbidden:true,
      aiMayAssistButNotEscalateAuthority:true,
      destructiveActionsRequireExplicitConfirmation:true,
      allInteractiveComponentsNeedStates:true,
    }),
  });
}
