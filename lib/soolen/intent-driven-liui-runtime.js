export const INTENT_DRIVEN_LIUI_RUNTIME_VERSION="1.0.0";

const SURFACES=Object.freeze({
  "app-builder":Object.freeze(["goal","plan","build","preview","issues","publish"]),
  research:Object.freeze(["question","sources","evidence","comparison","risks","decision"]),
  security:Object.freeze(["status","threats","evidence","actions","recovery"]),
  creative:Object.freeze(["brief","references","generate","compare","quality","assets"]),
  automation:Object.freeze(["goal","trigger","steps","approvals","history"]),
  general:Object.freeze(["intent","answer","evidence","actions"]),
});

function text(value,max=500){return String(value??"").trim().slice(0,max);}
export function classifyProductIntent(input={}){
  const goal=text(input.goal,1000).toLowerCase();
  let intent="general";
  if(/app|website|web app|ios|android|build|create.*site|开发|网站|应用/.test(goal))intent="app-builder";
  else if(/research|compare|analysis|evidence|研究|分析|比较/.test(goal))intent="research";
  else if(/malware|virus|security|threat|防毒|安全|诈骗/.test(goal))intent="security";
  else if(/image|video|design|creative|图片|视频|设计/.test(goal))intent="creative";
  else if(/automate|schedule|workflow|自动|定时|流程/.test(goal))intent="automation";
  return Object.freeze({intent,confidence:goal?0.8:0.2,requiresUserConfirmation:false});
}

export function createIntentDrivenSurface(input={}){
  const classified=input.intent?{intent:String(input.intent)}:classifyProductIntent(input);
  const intent=SURFACES[classified.intent]?classified.intent:"general";
  const cards=SURFACES[intent].map((id,index)=>Object.freeze({id,order:index+1,priority:index===0?"primary":"secondary",visible:true,state:"idle",evidenceRequired:["evidence","quality","publish","actions"].includes(id)}));
  return Object.freeze({version:INTENT_DRIVEN_LIUI_RUNTIME_VERSION,intent,cards:Object.freeze(cards),singlePrimaryAction:true,adaptiveBento:true,livingCards:true,voiceNativeEligible:true,accessibilityRequired:true,criticalErrorsAlwaysVisible:true,humanApprovalSurfaceRequired:true});
}

export function updateIntentSurface(surface,input={}){
  const active=text(input.activeCard,80);const status=String(input.status||"active").toLowerCase();
  const cards=surface.cards.map(card=>Object.freeze({...card,state:card.id===active?status:card.state,priority:card.id===active?"primary":card.priority==="primary"?"secondary":card.priority}));
  return Object.freeze({...surface,cards:Object.freeze(cards),activeCard:active||null,keyboardOpen:input.keyboardOpen===true,compactMode:input.compactMode===true,secondaryChromeReduced:input.keyboardOpen===true||input.compactMode===true});
}

export function createTrustPresentation(surface,input={}){
  const risk=String(input.risk||"normal").toLowerCase();const critical=["high","critical"].includes(risk)||input.production===true;
  return Object.freeze({intent:surface.intent,risk,showEvidence:critical||input.showEvidence===true,showApproval:critical,showRollback:input.externalSideEffects===true,showProviderIdentity:input.providerObserved===true,showEvidenceClass:true,mayHideCriticalWarning:false,marketingClaimFromUiStateAllowed:false});
}
