export const EDIT_SIMPLICITY_GATE_VERSION="1.0.0";

export const UI_COMPLEXITY_BUDGET=Object.freeze({primaryActions:1,topLevelActions:5,primaryNavigationItems:6,visiblePriorityBlocks:5,modalDepth:1,criticalDecisionsPerView:1});

export function evaluateEditSimplicity(candidate={}){
  const metrics={
    primaryActions:Number(candidate.primaryActions??1),
    topLevelActions:Number(candidate.topLevelActions??0),
    primaryNavigationItems:Number(candidate.primaryNavigationItems??0),
    visiblePriorityBlocks:Number(candidate.visiblePriorityBlocks??0),
    modalDepth:Number(candidate.modalDepth??0),
    criticalDecisionsPerView:Number(candidate.criticalDecisionsPerView??0),
  };
  const violations=Object.entries(UI_COMPLEXITY_BUDGET).filter(([key,max])=>Number(metrics[key]||0)>max).map(([key,max])=>Object.freeze({key,max,actual:metrics[key]}));
  if(candidate.meaninglessBento)violations.push(Object.freeze({key:"meaninglessBento",max:0,actual:1}));
  if(candidate.chatbotDominatesProduct)violations.push(Object.freeze({key:"chatbotDominatesProduct",max:0,actual:1}));
  if(candidate.horizontalPageScroll)violations.push(Object.freeze({key:"horizontalPageScroll",max:0,actual:1}));
  return Object.freeze({
    version:EDIT_SIMPLICITY_GATE_VERSION,passed:violations.length===0,metrics:Object.freeze(metrics),budget:UI_COMPLEXITY_BUDGET,violations:Object.freeze(violations),
    remediation:violations.length?Object.freeze(["keep-one-primary-action","progressively-disclose-secondary-controls","merge-redundant-cards","preserve-simple-new-user-surface"]):Object.freeze([]),
    principle:"Complexity stays inside LANERIQ. Simplicity stays with the user.",
  });
}
