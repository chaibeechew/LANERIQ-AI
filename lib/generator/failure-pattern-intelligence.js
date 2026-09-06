export const FAILURE_PATTERN_INTELLIGENCE_VERSION=1;

const STRATEGIES=Object.freeze([
  Object.freeze({
    id:"route_graph_repair",
    label:"Route graph repair",
    gateWeights:Object.freeze({execution:34,self_test:18,critic_contract:8,self_heal:6}),
    preflightWeights:Object.freeze({route_graph:34,data_workflow:8}),
    issuePatterns:Object.freeze([/route|navigation|path|screen|page target|entry route|destination/i]),
    directives:Object.freeze([
      "Rebuild the route graph first: every user-visible page needs one unique declared route and '/' must remain a valid entry route.",
      "Resolve every navigation item, CTA and action destination to an existing declared route; remove no working capability merely to make the graph pass.",
      "Preserve customer naming, Brand Kit and visual direction while repairing structural navigation consistency."
    ])
  }),
  Object.freeze({
    id:"workflow_state_repair",
    label:"Workflow and state repair",
    gateWeights:Object.freeze({execution:24,self_test:16,critic_contract:12,self_heal:10}),
    preflightWeights:Object.freeze({data_workflow:32,realtime_state:12}),
    issuePatterns:Object.freeze([/workflow|action|state|entity|data|record|transition|missing field|orphan/i]),
    directives:Object.freeze([
      "Reconnect pages, actions, entities and workflows so each major action has an explicit state transition or destination.",
      "Give each core data entity meaningful fields and one visible workflow responsibility; remove orphan actions and unreachable states without dropping requested features.",
      "Keep loading, empty, error and retry states aligned with the repaired workflow."
    ])
  }),
  Object.freeze({
    id:"security_boundary_repair",
    label:"Security boundary repair",
    gateWeights:Object.freeze({execution:26,self_test:10,critic_contract:16,self_heal:14}),
    preflightWeights:Object.freeze({security_permissions:38,external_integration:8}),
    issuePatterns:Object.freeze([/security|permission|role|auth|owner|private|secret|token|credential|authorization|access/i]),
    directives:Object.freeze([
      "Repair authentication, ownership, authorization, validation and secret boundaries fail-closed; never weaken a security check to satisfy quality verification.",
      "Make role and permission boundaries explicit in the specification while keeping credentials, tokens and private keys out of client-visible data.",
      "Preserve requested account and admin workflows only when they remain ownership-safe and authorization-safe."
    ])
  }),
  Object.freeze({
    id:"resilience_accessibility_repair",
    label:"Resilience and accessibility repair",
    gateWeights:Object.freeze({self_heal:34,execution:18,self_test:8,critic_contract:8}),
    preflightWeights:Object.freeze({realtime_state:14,media_integrity:10}),
    issuePatterns:Object.freeze([/accessib|contrast|keyboard|screen reader|aria|loading|empty|retry|fallback|offline|network|timeout|reduced motion|tap target/i]),
    directives:Object.freeze([
      "Add concrete loading, empty, error, timeout, retry/fallback and weak-network behavior where the affected flows need it.",
      "Repair readable contrast, accessible labels, keyboard/screen-reader semantics, touch targets, safe-area handling and reduced-motion behavior without flattening the product design.",
      "Keep resilience behavior tied to real user flows instead of adding vague quality text."
    ])
  }),
  Object.freeze({
    id:"external_truth_repair",
    label:"External integration truth repair",
    gateWeights:Object.freeze({critic_contract:26,execution:20,self_heal:10,self_test:6}),
    preflightWeights:Object.freeze({external_integration:40}),
    issuePatterns:Object.freeze([/provider|external|api|payment|webhook|email|whatsapp|map|cloud|notification|delivery|integration/i]),
    directives:Object.freeze([
      "Keep external services integration-ready only unless live evidence exists; do not claim provider, payment, delivery, notification, map or cloud success without evidence.",
      "Add timeout, error, retry and fallback behavior at each external boundary while preserving the requested integration contract.",
      "Separate internal specification readiness from external runtime/provider evidence."
    ])
  }),
  Object.freeze({
    id:"media_integrity_repair",
    label:"Media integrity repair",
    gateWeights:Object.freeze({execution:18,self_test:16,self_heal:16,critic_contract:6}),
    preflightWeights:Object.freeze({media_integrity:38}),
    issuePatterns:Object.freeze([/image|video|media|upload|file|asset|avatar|camera|gallery|url/i]),
    directives:Object.freeze([
      "Repair media references, supported states and secure URL handling; remove broken placeholders and insecure media assumptions without discarding customer-owned assets.",
      "Keep loading, error, empty and permission behavior explicit for upload, camera, gallery and media display flows.",
      "Preserve customer media intent and ownership/privacy boundaries."
    ])
  }),
  Object.freeze({
    id:"realtime_recovery_repair",
    label:"Realtime recovery repair",
    gateWeights:Object.freeze({execution:28,self_heal:16,self_test:8,critic_contract:8}),
    preflightWeights:Object.freeze({realtime_state:42}),
    issuePatterns:Object.freeze([/realtime|real-time|live|chat|message|presence|sync|reconnect|duplicate|idempot|disconnect|stream/i]),
    directives:Object.freeze([
      "Define reconnect, stale-state, duplicate-event/idempotency, timeout, disconnect and recovery behavior before treating the flow as realtime-ready.",
      "Keep simulated or planned realtime state clearly separated from observed live evidence.",
      "Repair event/state transitions deterministically so retries cannot duplicate customer actions."
    ])
  }),
  Object.freeze({
    id:"game_runtime_repair",
    label:"Game runtime repair",
    gateWeights:Object.freeze({execution:30,self_heal:18,self_test:12,critic_contract:10}),
    preflightWeights:Object.freeze({game_runtime:46,realtime_state:12}),
    issuePatterns:Object.freeze([/game|moba|combat|match|physics|multiplayer|5v5|hero|skill|win|lose|restart|authoritative/i]),
    directives:Object.freeze([
      "Repair gameplay state deterministically: controls, combat/state transitions, win/fail/restart behavior and entity/performance budgets must be explicit and testable.",
      "For multiplayer, preserve authoritative state and reconnect/idempotency contracts; do not relabel simulated multiplayer as verified online play.",
      "Keep requested gameplay depth while fixing runtime determinism rather than simplifying the game into a static mock."
    ])
  }),
  Object.freeze({
    id:"specification_consistency_repair",
    label:"Specification consistency repair",
    gateWeights:Object.freeze({self_test:28,critic_contract:22,execution:14,self_heal:12}),
    preflightWeights:Object.freeze({route_graph:8,data_workflow:8,security_permissions:6}),
    issuePatterns:Object.freeze([/specification|missing|required|invalid|incomplete|duplicate|structure|contract|quality gate/i]),
    directives:Object.freeze([
      "Reconcile the full specification before cosmetic changes: pages, routes, navigation, features, actions, data, quality plan and design system must agree with each other.",
      "Restore missing required structure and remove contradictory or duplicate declarations without removing working customer-requested capabilities.",
      "Return one complete corrected specification rather than a patch or explanation."
    ])
  })
]);

function list(value){return Array.isArray(value)?value:[];}
function text(value){return String(value||"").trim();}
function clamp(value,min=0,max=100){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;}
function unique(values){return [...new Set(values.filter(Boolean))];}
function issueText(diagnostics){return list(diagnostics?.failedGates).flatMap(gate=>list(gate?.issues)).map(text).join(" ").slice(0,4000);}

function scoreStrategy(strategy,diagnostics={}){
  const failedGateIds=unique(list(diagnostics?.failedGateIds).map(text));
  const preflightRiskIds=unique(list(diagnostics?.preflight?.riskIds).map(text));
  const issues=issueText(diagnostics);
  const signalIds=[];
  let score=0;
  for(const gateId of failedGateIds){const weight=Number(strategy.gateWeights?.[gateId]||0);if(weight>0){score+=weight;signalIds.push(`gate:${gateId}`);}}
  for(const riskId of preflightRiskIds){const weight=Number(strategy.preflightWeights?.[riskId]||0);if(weight>0){score+=weight;signalIds.push(`preflight:${riskId}`);}}
  const issueHits=list(strategy.issuePatterns).filter(pattern=>pattern.test(issues)).length;
  if(issueHits){score+=Math.min(28,issueHits*14);signalIds.push(`issue-pattern:${strategy.id}`);}
  return {strategy,score:Math.round(clamp(score,0,100)),signalIds:unique(signalIds)};
}

export function rankFailureRecoveryStrategies(diagnostics={}){
  const ranked=STRATEGIES.map(strategy=>scoreStrategy(strategy,diagnostics))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.strategy.id.localeCompare(b.strategy.id));
  const effective=ranked.length?ranked:[{strategy:STRATEGIES.find(item=>item.id==="specification_consistency_repair"),score:20,signalIds:["fallback:deterministic-verification"]}];
  return Object.freeze(effective.map((item,index)=>Object.freeze({
    rank:index+1,
    strategyId:item.strategy.id,
    label:item.strategy.label,
    relevanceScore:item.score,
    signalIds:Object.freeze(item.signalIds),
    directives:item.strategy.directives,
  })));
}

export function selectFailureRecoveryStrategy(diagnostics={},attempt=1){
  const ranked=rankFailureRecoveryStrategies(diagnostics);
  const index=Math.max(0,Math.min(ranked.length-1,Math.max(1,Number(attempt)||1)-1));
  return ranked[index];
}

export function summarizeFailureRecoveryPlan(diagnostics={}){
  const ranked=rankFailureRecoveryStrategies(diagnostics).slice(0,4);
  return Object.freeze({
    schemaVersion:FAILURE_PATTERN_INTELLIGENCE_VERSION,
    topStrategyId:ranked[0]?.strategyId||"specification_consistency_repair",
    ranked:Object.freeze(ranked.map(item=>Object.freeze({rank:item.rank,strategyId:item.strategyId,relevanceScore:item.relevanceScore,signalIds:item.signalIds}))),
    deterministic:true,
    privacySafe:true,
    storesRawPrompt:false,
    storesRawFailureText:false,
    predictsRecoveryProbability:false,
    methodology:"laneriq-failure-pattern-recovery-ranking-v1-deterministic-current-run-signals",
  });
}

export function buildFailureRecoveryStrategyInstruction(diagnostics={},attempt=1,maxAttempts=2){
  const selected=selectFailureRecoveryStrategy(diagnostics,attempt);
  return [
    `SOOLEN FAILURE-PATTERN RECOVERY STRATEGY ${Math.max(1,Number(attempt)||1)}/${Math.max(1,Number(maxAttempts)||1)}`,
    `Selected strategy: ${selected.label} [${selected.strategyId}]`,
    `Deterministic relevance: ${selected.relevanceScore}/100. This is a strategy-ranking signal, not a recovery probability.`,
    "Apply this strategy before broad visual rewriting:",
    ...list(selected.directives).map(item=>`- ${item}`),
    "Do not weaken any deterministic verification, security, privacy, ownership or truth boundary to make the candidate pass."
  ].join("\n");
}

export const FAILURE_PATTERN_INTELLIGENCE_POLICY=Object.freeze({
  version:FAILURE_PATTERN_INTELLIGENCE_VERSION,
  deterministic:true,
  currentRunSignalsOnly:true,
  rawPromptStorage:false,
  rawFailureTextStorage:false,
  recoveryProbabilityClaim:false,
  zeroPaidEmbeddingDependency:true,
  zeroVectorDatabaseDependency:true,
  noDedicatedServerRequired:true,
  strategyIds:Object.freeze(STRATEGIES.map(item=>item.id)),
});
