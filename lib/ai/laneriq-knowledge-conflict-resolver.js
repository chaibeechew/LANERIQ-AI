const IMMUTABLE_RULES=Object.freeze([
  {id:"no-silent-paid-escalation",patterns:[/zero|free/i,/metered|paid|spend/i]},
  {id:"mobile-no-cross-user-compute",patterns:[/mobile|ios|android/i,/cross-user|cross-customer|community compute/i]},
  {id:"owner-scoped-private-data",patterns:[/private|memory|asset|data/i,/owner|customer|user/i]},
  {id:"code-not-live",patterns:[/code|preview|configured|emulator|synthetic/i,/live|production/i]},
  {id:"avatar-no-privileged-authority",patterns:[/avatar|character/i,/execution|privileged|authority|action/i]}
]);
function clean(value,max=1000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function textOf(value){return clean(value).toLowerCase();}

export function detectImmutableKnowledgeConflict({lesson="",proposedEffect=""}={}){
  const text=textOf(`${lesson} ${proposedEffect}`),conflicts=[];
  if(/allow|enable|bypass|ignore|skip|silently|automatic/.test(text)){
    for(const rule of IMMUTABLE_RULES){if(rule.patterns.every(pattern=>pattern.test(text)))conflicts.push(rule.id);}
  }
  return{contract:"laneriq-knowledge-conflict-v1",conflicts,allowed:conflicts.length===0};
}

export function resolveKnowledgeConflict({existing=[],candidate={}}={}){
  const immutable=detectImmutableKnowledgeConflict(candidate);
  if(!immutable.allowed)return{contract:"laneriq-knowledge-resolution-v1",decision:"reject-candidate",reason:"immutable-boundary-conflict",conflicts:immutable.conflicts,winner:"existing-policy"};
  const active=(Array.isArray(existing)?existing:[]).filter(item=>item?.status==="production_rule"||item?.status==="validated");
  const sameDomain=active.filter(item=>clean(item?.domain,48)===clean(candidate?.domain,48));
  if(!sameDomain.length)return{contract:"laneriq-knowledge-resolution-v1",decision:"candidate-may-proceed-to-evidence",reason:"no-active-domain-conflict",conflicts:[],winner:null};
  return{contract:"laneriq-knowledge-resolution-v1",decision:"manual-comparison-required",reason:"active-domain-knowledge-exists",conflicts:sameDomain.map(item=>clean(item?.id,40)).filter(Boolean),winner:null};
}

export function immutableKnowledgeRuleIds(){return IMMUTABLE_RULES.map(rule=>rule.id);}
