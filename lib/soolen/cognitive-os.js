// LANERIQ Cognitive Operating System v1
// Provider-independent orchestration primitives for reasoning, simulation,
// council review, uncertainty, failure memory, verification and execution policy.

export const LANERIQ_COGNITIVE_OS_VERSION = "1.0.0";

export const COGNITIVE_LAYERS = Object.freeze([
  "intent",
  "context",
  "memory-graph",
  "knowledge",
  "cognitive-router",
  "model-router",
  "reasoning",
  "multi-agent-council",
  "world-simulator",
  "planner",
  "execution",
  "verification",
  "judge",
  "security-trust",
  "self-healing",
  "learning",
  "personal-intelligence",
  "autonomous-workflow",
  "intelligence-benchmark",
  "meta-cognition",
]);

export const REASONING_MODES = Object.freeze({
  FAST: "fast",
  DEEP: "deep",
  COUNCIL: "council",
  VERIFIED_CRITICAL: "verified-critical",
});

export const EVIDENCE_CLASSES = Object.freeze({
  INTERNAL: "INTERNAL",
  SIMULATED: "SIMULATED",
  STATIC_PREFLIGHT: "STATIC_PREFLIGHT",
  MEASURED_OR_ATTESTED: "MEASURED_OR_ATTESTED",
  PRODUCTION: "PRODUCTION",
});

const EVIDENCE_RANK = Object.freeze({
  INTERNAL: 1,
  SIMULATED: 2,
  STATIC_PREFLIGHT: 3,
  MEASURED_OR_ATTESTED: 4,
  PRODUCTION: 5,
});

export const COUNCIL_ROLES = Object.freeze([
  { id: "explorer", purpose: "find high-upside and non-obvious approaches" },
  { id: "conservative", purpose: "find the most reliable and reversible approach" },
  { id: "challenger", purpose: "attack assumptions and expose failure modes" },
  { id: "evidence", purpose: "check evidence quality, unknowns and unsupported claims" },
  { id: "systems", purpose: "analyze cross-system, cost, dependency and second-order effects" },
  { id: "judge", purpose: "compare independent candidates against deterministic gates" },
]);

function text(value, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, num(value, min)));
}

function integer(value, min = 0, max = 1_000_000) {
  return Math.min(max, Math.max(min, Math.round(num(value, min))));
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function riskLevel(value) {
  const normalized = text(value || "medium", 20).toLowerCase();
  return ["low", "medium", "high", "critical"].includes(normalized) ? normalized : "medium";
}

function evidenceClass(value) {
  const normalized = text(value || EVIDENCE_CLASSES.INTERNAL, 40).toUpperCase();
  return EVIDENCE_RANK[normalized] ? normalized : EVIDENCE_CLASSES.INTERNAL;
}

export function assessUncertainty(input = {}) {
  const evidenceCoverage = clamp(input.evidenceCoverage ?? 0);
  const sourceAgreement = clamp(input.sourceAgreement ?? 0.5);
  const testCoverage = clamp(input.testCoverage ?? 0);
  const contradictionCount = integer(input.contradictionCount ?? 0, 0, 1000);
  const unknownCount = integer(input.unknownCount ?? 0, 0, 1000);
  const externalVerificationRequired = input.externalVerificationRequired === true;
  const currentEvidenceClass = evidenceClass(input.evidenceClass);

  const contradictionPenalty = Math.min(0.35, contradictionCount * 0.07);
  const unknownPenalty = Math.min(0.30, unknownCount * 0.04);
  const classBonus = (EVIDENCE_RANK[currentEvidenceClass] - 1) * 0.04;
  const rawConfidence =
    evidenceCoverage * 0.42 +
    sourceAgreement * 0.25 +
    testCoverage * 0.25 +
    classBonus -
    contradictionPenalty -
    unknownPenalty -
    (externalVerificationRequired ? 0.08 : 0);

  const confidence = clamp(rawConfidence);
  const uncertainty = clamp(1 - confidence);
  const requiresEscalation =
    confidence < 0.72 ||
    contradictionCount > 0 ||
    unknownCount >= 3 ||
    externalVerificationRequired;

  return freezeDeep({
    confidence,
    uncertainty,
    evidenceCoverage,
    sourceAgreement,
    testCoverage,
    contradictionCount,
    unknownCount,
    evidenceClass: currentEvidenceClass,
    externalVerificationRequired,
    requiresEscalation,
  });
}

export function selectReasoningMode(input = {}) {
  const complexity = clamp(input.complexity ?? 0.5);
  const impact = clamp(input.impact ?? 0.5);
  const reversibility = clamp(input.reversibility ?? 0.5);
  const risk = riskLevel(input.risk);
  const uncertainty = clamp(input.uncertainty ?? 0.5);
  const externalSideEffects = input.externalSideEffects === true;

  if (
    risk === "critical" ||
    (risk === "high" && externalSideEffects) ||
    (impact >= 0.85 && reversibility <= 0.35)
  ) return REASONING_MODES.VERIFIED_CRITICAL;

  if (risk === "high" || complexity >= 0.75 || uncertainty >= 0.55 || impact >= 0.75) {
    return REASONING_MODES.COUNCIL;
  }
  if (complexity >= 0.4 || uncertainty >= 0.3) return REASONING_MODES.DEEP;
  return REASONING_MODES.FAST;
}

export function createCognitiveCouncil(input = {}) {
  const goal = text(input.goal);
  if (!goal) throw new Error("LANERIQ_COGNITIVE_GOAL_REQUIRED");
  const mode = text(input.mode || "blind-independent", 40);
  const roles = COUNCIL_ROLES.map((role, index) => ({
    ...role,
    seat: index + 1,
    goal,
    visibility: role.id === "judge" ? "candidate-summaries-after-round-1" : "goal-and-evidence-only",
    maySeeOtherCandidateAnswersBeforeRound1: false,
    maySelfGrantPermissions: false,
  }));
  return freezeDeep({
    mode,
    blindRoundRequired: true,
    independentFirstPass: true,
    judgeSeesCandidatesOnlyAfterIndependentPass: true,
    roles,
  });
}

export function createCounterfactuals(input = {}) {
  const goal = text(input.goal);
  const dependency = text(input.criticalDependency || "primary dependency", 300);
  const provider = text(input.primaryProvider || "primary provider", 120);
  return freezeDeep([
    { id: "do-nothing", question: `What happens if LANERIQ does not pursue: ${goal}?` },
    { id: "dependency-fails", question: `What happens if ${dependency} fails or becomes unavailable?` },
    { id: "provider-outage", question: `What happens if ${provider} is unavailable, degraded, or changes terms?` },
    { id: "scale-100x", question: "What breaks if demand, traffic, or workload increases by 100x?" },
    { id: "judge-wrong", question: "What happens if the evaluator or judge is wrong?" },
    { id: "policy-change", question: "What changes if an external policy, platform rule, or compliance constraint changes?" },
  ]);
}

export function buildSimulationPlan(input = {}) {
  const goal = text(input.goal);
  if (!goal) throw new Error("LANERIQ_SIMULATION_GOAL_REQUIRED");
  const metrics = Array.isArray(input.metrics)
    ? input.metrics.map((v) => text(v, 100)).filter(Boolean).slice(0, 20)
    : [];
  const scenarios = [
    { id: "baseline", demandMultiplier: 1, failurePressure: 0, costPressure: 0 },
    { id: "growth", demandMultiplier: 10, failurePressure: 0.1, costPressure: 0.25 },
    { id: "stress", demandMultiplier: 100, failurePressure: 0.45, costPressure: 0.6 },
    { id: "provider-outage", demandMultiplier: 1, failurePressure: 0.9, costPressure: 0.2 },
    { id: "adversarial", demandMultiplier: 3, failurePressure: 0.7, costPressure: 0.35 },
  ];
  return freezeDeep({
    goal,
    evidenceClass: EVIDENCE_CLASSES.SIMULATED,
    mayPromoteToMeasuredEvidence: false,
    mayPromoteToProductionEvidence: false,
    metrics,
    scenarios,
    counterfactuals: createCounterfactuals(input),
  });
}

export function chooseModelStrategy(input = {}) {
  const required = new Set(
    (Array.isArray(input.requiredCapabilities) ? input.requiredCapabilities : [])
      .map((value) => text(value, 80))
      .filter(Boolean),
  );
  const mode = input.reasoningMode || REASONING_MODES.DEEP;
  if (mode === REASONING_MODES.COUNCIL || mode === REASONING_MODES.VERIFIED_CRITICAL) {
    required.add("reasoning");
    required.add("structured_output");
  }
  if (input.requiresTools === true) required.add("tool_calling");
  if (input.requiresVision === true) required.add("vision");
  if (input.requiresLongContext === true) required.add("long_context");

  return freezeDeep({
    providerIndependent: true,
    requiredCapabilities: [...required],
    selectionPolicy: "capability-first-then-quality-latency-cost-availability",
    failoverRequired: mode !== REASONING_MODES.FAST,
    crossProviderVerificationPreferred:
      mode === REASONING_MODES.COUNCIL || mode === REASONING_MODES.VERIFIED_CRITICAL,
    dedicatedLANERIQServerRequired: false,
  });
}

export function buildExecutionPolicy(input = {}) {
  const risk = riskLevel(input.risk);
  const mode = input.reasoningMode || REASONING_MODES.DEEP;
  const externalSideEffects = input.externalSideEffects === true;
  const destructive = input.destructive === true;
  const financial = input.financial === true;
  const production = input.production === true;

  const humanApprovalRequired =
    destructive ||
    financial ||
    production ||
    risk === "critical" ||
    (risk === "high" && externalSideEffects) ||
    mode === REASONING_MODES.VERIFIED_CRITICAL;

  return freezeDeep({
    leastPrivilege: true,
    sandboxExecutableWork: true,
    userAuthorizedScopeOnly: true,
    networkPermissionMustBeExplicit: true,
    backgroundComputeMustBeExplicit: true,
    sharedComputeMustBeExplicit: true,
    privateDataReuseMustBeExplicit: true,
    humanApprovalRequired,
    automaticExecutionAllowed: !humanApprovalRequired && risk !== "critical",
    rollbackPlanRequired: production || destructive || externalSideEffects,
    dryRunPreferred: externalSideEffects || production || destructive,
  });
}

export function createFailureMemoryRecord(input = {}) {
  const forbidden = [
    input.rawPrompt,
    input.rawCustomerData,
    input.credentials,
    input.secret,
    input.privateFile,
    input.sourceCode,
  ].some((value) => value !== undefined && value !== null && String(value).length > 0);
  if (forbidden) throw new Error("LANERIQ_FAILURE_MEMORY_RAW_PRIVATE_DATA_REJECTED");

  return freezeDeep({
    schemaVersion: "1",
    createdAt: new Date().toISOString(),
    category: text(input.category || "general", 100),
    failureCode: text(input.failureCode || "UNKNOWN", 120),
    strategy: text(input.strategy || "", 800),
    repairPattern: text(input.repairPattern || "", 800),
    preventedBy: text(input.preventedBy || "", 300),
    successAfterRepair: input.successAfterRepair === true,
    providerClass: text(input.providerClass || "", 80),
    runtimeClass: text(input.runtimeClass || "", 80),
    containsCustomerRawData: false,
    containsSecrets: false,
    reusableAcrossCustomers: input.reusableAcrossCustomers !== false,
  });
}

export function evaluateCognitiveResult(input = {}) {
  const uncertainty = assessUncertainty(input.uncertainty || {});
  const requiredEvidenceClass = evidenceClass(input.requiredEvidenceClass || EVIDENCE_CLASSES.INTERNAL);
  const observedEvidenceClass = evidenceClass(input.observedEvidenceClass || uncertainty.evidenceClass);
  const evidenceSufficient = EVIDENCE_RANK[observedEvidenceClass] >= EVIDENCE_RANK[requiredEvidenceClass];

  const checks = {
    completed: input.completed === true,
    testsPassed: input.testsPassed === true,
    securityPassed: input.securityPassed === true,
    privacyPassed: input.privacyPassed === true,
    outputVerified: input.outputVerified === true,
    evidenceSufficient,
    contradictionsResolved: uncertainty.contradictionCount === 0,
    confidenceSufficient: uncertainty.confidence >= clamp(input.minimumConfidence ?? 0.72),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const critical = input.critical === true || riskLevel(input.risk) === "critical";
  const accepted = failed.length === 0;

  return freezeDeep({
    accepted,
    action: accepted ? "accept" : critical ? "block-and-escalate" : "repair-or-reason-again",
    checks,
    failed,
    uncertainty,
    observedEvidenceClass,
    requiredEvidenceClass,
    mayClaimProductionVerified: accepted && observedEvidenceClass === EVIDENCE_CLASSES.PRODUCTION,
  });
}

export function createCognitiveRun(input = {}) {
  const goal = text(input.goal);
  if (!goal) throw new Error("LANERIQ_COGNITIVE_GOAL_REQUIRED");

  const uncertainty = assessUncertainty(input.uncertainty || {});
  const reasoningMode = selectReasoningMode({
    complexity: input.complexity,
    impact: input.impact,
    reversibility: input.reversibility,
    risk: input.risk,
    uncertainty: uncertainty.uncertainty,
    externalSideEffects: input.externalSideEffects,
  });
  const councilRequired =
    reasoningMode === REASONING_MODES.COUNCIL ||
    reasoningMode === REASONING_MODES.VERIFIED_CRITICAL;

  return freezeDeep({
    cognitiveOSVersion: LANERIQ_COGNITIVE_OS_VERSION,
    goal,
    taskType: text(input.taskType || "general", 100),
    layers: [...COGNITIVE_LAYERS],
    reasoningMode,
    uncertainty,
    council: councilRequired ? createCognitiveCouncil({ goal }) : null,
    simulation: input.simulationRequired === false ? null : buildSimulationPlan({
      goal,
      metrics: input.metrics,
      criticalDependency: input.criticalDependency,
      primaryProvider: input.primaryProvider,
    }),
    modelStrategy: chooseModelStrategy({
      reasoningMode,
      requiredCapabilities: input.requiredCapabilities,
      requiresTools: input.requiresTools,
      requiresVision: input.requiresVision,
      requiresLongContext: input.requiresLongContext,
    }),
    executionPolicy: buildExecutionPolicy({
      reasoningMode,
      risk: input.risk,
      externalSideEffects: input.externalSideEffects,
      destructive: input.destructive,
      financial: input.financial,
      production: input.production,
    }),
    verificationLoop: [
      "reason",
      "independent-council-when-required",
      "simulate-and-counterfact",
      "plan",
      "dry-run-when-required",
      "act-within-permission-boundary",
      "test",
      "verify-evidence",
      "judge",
      "bounded-repair",
      "re-verify",
      "extract-safe-failure-or-success-memory",
      "meta-evaluate",
    ],
  });
}
