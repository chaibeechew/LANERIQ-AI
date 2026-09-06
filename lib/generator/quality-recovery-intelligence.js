export const GENERATION_QUALITY_PREFLIGHT_VERSION=1;

const RISK_RULES=Object.freeze([
  Object.freeze({
    id:"route_graph",
    label:"Route and navigation graph",
    weight:12,
    patterns:[/dashboard|admin|profile|settings|checkout|booking|appointment|catalog|listing|detail|portal|workspace|onboarding/i],
    directive:"Define every user-visible route before generation. Keep page routes unique, ensure every navigation/action target resolves to a declared route, and keep '/' as a valid entry route."
  }),
  Object.freeze({
    id:"data_workflow",
    label:"Data and workflow coherence",
    weight:14,
    patterns:[/crm|lead|client|customer|record|booking|appointment|order|inventory|pipeline|workflow|task|report|analytics|property|listing|reservation/i],
    directive:"Connect pages, actions, data entities and workflows explicitly. Every major action must have a destination/state change and every core entity must have meaningful fields and a visible workflow responsibility."
  }),
  Object.freeze({
    id:"security_permissions",
    label:"Security and permissions",
    weight:15,
    patterns:[/login|sign in|account|auth|role|admin|owner|private|permission|payment|checkout|billing|subscription|wallet|member/i],
    directive:"Keep authentication, ownership, authorization, validation and secret handling fail-closed. State role/permission boundaries and never place credentials, tokens or private keys in generated client-visible specification data."
  }),
  Object.freeze({
    id:"external_integration",
    label:"External integration truth boundary",
    weight:15,
    patterns:[/api|stripe|paypal|map|google|calendar|email|whatsapp|sms|push|webhook|integration|provider|cloud|external|payment/i],
    directive:"Treat external services as integration-ready only unless live evidence exists. Include timeout/error/retry/fallback behavior and never claim a provider connection, delivery, payment, map, notification or cloud action succeeded without evidence."
  }),
  Object.freeze({
    id:"media_integrity",
    label:"Media and upload integrity",
    weight:10,
    patterns:[/upload|photo|image|video|camera|gallery|media|avatar|file|document|audio/i],
    directive:"Define safe media states, supported use cases, loading/error/empty behavior, ownership/privacy expectations and secure URL handling. Avoid insecure HTTP media and broken placeholder URLs."
  }),
  Object.freeze({
    id:"realtime_state",
    label:"Realtime and recovery state",
    weight:13,
    patterns:[/chat|message|live|realtime|real-time|notification|presence|multiplayer|matchmaking|sync|stream/i],
    directive:"Define reconnect, stale-state, duplicate-event/idempotency, timeout, disconnect and recovery behavior. Do not present simulated realtime/provider state as live evidence."
  }),
  Object.freeze({
    id:"game_runtime",
    label:"Game runtime determinism",
    weight:16,
    patterns:[/game|moba|rpg|shooter|racing|battle|multiplayer|5v5|physics|combat|hero|matchmaking/i],
    directive:"Keep gameplay state deterministic and testable. Define controls, win/fail/restart behavior, performance/entity budgets and authoritative multiplayer contracts before claiming competitive online readiness."
  }),
]);

const BASELINE_DIRECTIVES=Object.freeze([
  "Produce a complete specification on the first pass: pages, routes, navigation, features, data/actions, quality plan and design system must agree with each other.",
  "Include concrete loading, error, empty, retry/fallback and weak-network behavior where relevant; do not satisfy resilience with vague quality claims.",
  "Keep mobile-first responsiveness, safe-area handling, readable contrast, accessible touch targets and reduced-motion behavior explicit where relevant.",
  "Preserve customer-selected name, language, Brand Kit, colors, theme and wallpaper direction unless safety or accessibility requires a correction.",
  "Do not weaken deterministic verification requirements and do not invent external-provider, browser, device, store or Production success."
]);

function list(value){return Array.isArray(value)?value:[];}
function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function text(value){return String(value||"").trim();}
function unique(values){return [...new Set(values.filter(Boolean))];}
function clamp(value,min=0,max=100){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;}
function safeIndustrySignals(industryPlan={}){
  const plan=object(industryPlan);
  return [
    ...list(plan.pages),...list(plan.data),...list(plan.workflows),...list(plan.roles),
    text(plan.label),text(plan.profileId)
  ].filter(Boolean).join(" ");
}
function safeRequirementSignals(requirements={}){
  const input=object(requirements);
  const rows=[];
  for(const key of ["requiredFeatures","features","pages","roles","workflows","capabilities"]){
    for(const value of list(input[key]).slice(0,30))rows.push(typeof value==="string"?value:JSON.stringify(value));
  }
  return rows.join(" ");
}
function band(score){return score>=70?"high":score>=40?"moderate":"normal";}
function summarizeRisk(rule,matchedBy){return Object.freeze({id:rule.id,label:rule.label,weight:rule.weight,matchedBy:Object.freeze(unique(matchedBy))});}

export function buildGenerationQualityPreflight({idea="",industryPlan={},requirements={},assetCount=0,referenceCount=0}={}){
  const source=text(idea);
  const industry=safeIndustrySignals(industryPlan);
  const requirement=safeRequirementSignals(requirements);
  const combined=`${source} ${industry} ${requirement}`.slice(0,24000);
  const risks=[];
  for(const rule of RISK_RULES){
    const matchedBy=[];
    if(rule.patterns.some(pattern=>pattern.test(source)))matchedBy.push("customer_intent");
    if(rule.patterns.some(pattern=>pattern.test(industry)))matchedBy.push("industry_plan");
    if(rule.patterns.some(pattern=>pattern.test(requirement)))matchedBy.push("requirements");
    if(matchedBy.length)risks.push(summarizeRisk(rule,matchedBy));
  }
  if(Number(assetCount)>0||Number(referenceCount)>0){
    const mediaRule=RISK_RULES.find(rule=>rule.id==="media_integrity");
    if(mediaRule&&!risks.some(risk=>risk.id==="media_integrity"))risks.push(summarizeRisk(mediaRule,["customer_assets"]));
  }
  const scopeSignals={
    plannedPages:list(object(industryPlan).pages).length,
    plannedData:list(object(industryPlan).data).length,
    plannedWorkflows:list(object(industryPlan).workflows).length,
    plannedRoles:list(object(industryPlan).roles).length,
    assetCount:Math.max(0,Math.min(20,Number(assetCount)||0)),
    referenceCount:Math.max(0,Math.min(10,Number(referenceCount)||0)),
  };
  const scopePressure=Math.min(18,Math.max(0,scopeSignals.plannedPages-3)*2+Math.max(0,scopeSignals.plannedWorkflows-1)*3+Math.max(0,scopeSignals.plannedRoles-1)*2+Math.min(4,scopeSignals.assetCount)+Math.min(3,scopeSignals.referenceCount));
  const pressureScore=Math.round(clamp(risks.reduce((sum,risk)=>sum+risk.weight,0)+scopePressure));
  const preventiveDirectives=unique([
    ...BASELINE_DIRECTIVES,
    ...risks.map(risk=>RISK_RULES.find(rule=>rule.id===risk.id)?.directive),
  ]);
  return Object.freeze({
    schemaVersion:GENERATION_QUALITY_PREFLIGHT_VERSION,
    pressureScore,
    riskBand:band(pressureScore),
    riskIds:Object.freeze(risks.map(risk=>risk.id)),
    risks:Object.freeze(risks),
    scope:Object.freeze(scopeSignals),
    preventiveDirectives:Object.freeze(preventiveDirectives),
    methodology:"laneriq-generation-quality-preflight-v1-deterministic-no-history-no-embeddings",
    privacySafe:true,
    storesRawUserPrompt:false,
    predictsFailureProbability:false,
    evidenceBoundary:"Preventive generation guidance only. Risk pressure is not a probability and does not prove runtime, provider, browser, device, store or Production success.",
    _internalSignalLength:combined.length,
  });
}

export function summarizeGenerationQualityPreflight(preflight={}){
  return Object.freeze({
    schemaVersion:Number(preflight?.schemaVersion)||GENERATION_QUALITY_PREFLIGHT_VERSION,
    pressureScore:Math.round(clamp(preflight?.pressureScore)),
    riskBand:["normal","moderate","high"].includes(preflight?.riskBand)?preflight.riskBand:"normal",
    riskIds:Object.freeze(unique(list(preflight?.riskIds).map(value=>text(value).slice(0,80))).slice(0,12)),
    preventiveDirectiveCount:Math.max(0,Math.min(30,list(preflight?.preventiveDirectives).length)),
    methodology:text(preflight?.methodology).slice(0,120)||"laneriq-generation-quality-preflight-v1-deterministic-no-history-no-embeddings",
    privacySafe:true,
    storesRawUserPrompt:false,
    predictsFailureProbability:false,
  });
}

export function buildGenerationQualityPreflightInstruction(preflight={}){
  const risks=list(preflight?.risks);
  const directives=list(preflight?.preventiveDirectives);
  const riskLines=risks.length?risks.map(risk=>`- ${text(risk?.label||risk?.id)} [${text(risk?.id)}]`):["- baseline product quality [baseline]"];
  return [
    "SOOLEN PREVENTIVE QUALITY PREFLIGHT",
    `Deterministic quality pressure: ${Math.round(clamp(preflight?.pressureScore))}/100 (${["normal","moderate","high"].includes(preflight?.riskBand)?preflight.riskBand:"normal"}). This is not a failure probability.`,
    "Build to prevent these likely verification pressure areas before the first candidate is returned:",
    ...riskLines,
    "PREVENTIVE DIRECTIVES:",
    ...directives.map(item=>`- ${text(item).slice(0,700)}`),
    "Return the full product specification only. Do not weaken or bypass any quality, security, privacy or truth boundary.",
  ].join("\n");
}

export const GENERATION_QUALITY_PREFLIGHT_POLICY=Object.freeze({
  version:GENERATION_QUALITY_PREFLIGHT_VERSION,
  deterministic:true,
  zeroPaidEmbeddingDependency:true,
  zeroVectorDatabaseDependency:true,
  noDedicatedServerRequired:true,
  rawPromptStorage:false,
  failureProbabilityClaim:false,
  riskIds:Object.freeze(RISK_RULES.map(rule=>rule.id)),
});
