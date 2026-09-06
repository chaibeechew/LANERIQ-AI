const STAGE_ORDER = Object.freeze({
  idea: 0,
  planned: 1,
  ready: 2,
  in_progress: 3,
  code_complete: 4,
  verification: 5,
  release_candidate: 6,
  production: 7,
  observed: 8,
  closed: 9,
});

export const CONTROL_TOWER_STANDARD_GATES = Object.freeze([
  { gate_key: "ci", label: "CI / required checks", required: true, phase: "rc" },
  { gate_key: "security", label: "Security verification", required: true, phase: "rc" },
  { gate_key: "database", label: "Database / migration verification", required: true, phase: "rc" },
  { gate_key: "api", label: "API contract verification", required: true, phase: "rc" },
  { gate_key: "performance", label: "Performance readiness", required: true, phase: "rc" },
  { gate_key: "accessibility", label: "Accessibility readiness", required: true, phase: "rc" },
  { gate_key: "mobile", label: "Mobile / safe-area readiness", required: true, phase: "rc" },
  { gate_key: "billing", label: "Billing / entitlement integrity", required: true, phase: "rc" },
  { gate_key: "github-main", label: "GitHub main identity", required: true, phase: "production" },
  { gate_key: "runtime-identity", label: "Runtime build identity", required: true, phase: "production" },
  { gate_key: "exact-sha", label: "GitHub main = Production runtime SHA", required: true, phase: "production" },
  { gate_key: "supabase", label: "Supabase runtime verification", required: true, phase: "production" },
]);

export const CONTROL_TOWER_NON_WAIVABLE_GATES = Object.freeze([
  "ci",
  "security",
  "database",
  "github-main",
  "runtime-identity",
  "exact-sha",
  "supabase",
]);

const STANDARD_GATE_BY_KEY = new Map(CONTROL_TOWER_STANDARD_GATES.map((gate) => [gate.gate_key, gate]));
const RC_STANDARD_GATE_KEYS = new Set(CONTROL_TOWER_STANDARD_GATES.filter((gate) => gate.phase === "rc").map((gate) => gate.gate_key));
const PRODUCTION_STANDARD_GATE_KEYS = new Set(CONTROL_TOWER_STANDARD_GATES.map((gate) => gate.gate_key));
const PRODUCTION_ONLY_GATE_KEYS = new Set(CONTROL_TOWER_STANDARD_GATES.filter((gate) => gate.phase === "production").map((gate) => gate.gate_key));
const NON_WAIVABLE_GATE_KEYS = new Set(CONTROL_TOWER_NON_WAIVABLE_GATES);

export function isControlTowerGateWaivable(gateKey) {
  return !NON_WAIVABLE_GATE_KEYS.has(String(gateKey || "").trim().toLowerCase());
}

export function controlTowerGatePhase(gateKey) {
  return STANDARD_GATE_BY_KEY.get(String(gateKey || "").trim().toLowerCase())?.phase || "rc";
}

function stageRank(stage) {
  return STAGE_ORDER[String(stage || "").toLowerCase()] ?? -1;
}

function normalizedDependencies(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))]
    : [];
}

export function analyzeWorkstreamDependencies(workstreams = []) {
  const byKey = new Map(
    workstreams
      .filter((item) => item?.workstream_key)
      .map((item) => [String(item.workstream_key).toLowerCase(), item]),
  );
  const missing = [];
  const blocked = [];
  const adjacency = new Map();

  for (const workstream of workstreams) {
    const key = String(workstream.workstream_key || "").toLowerCase();
    const deps = normalizedDependencies(workstream.dependencies);
    adjacency.set(key, deps.filter((dep) => byKey.has(dep)));
    for (const dep of deps) {
      const target = byKey.get(dep);
      if (!target) {
        missing.push({ workstream: key, dependency: dep });
        continue;
      }
      if (stageRank(target.stage) < STAGE_ORDER.code_complete) {
        blocked.push({
          workstream: key,
          dependency: dep,
          dependencyStage: target.stage || "unknown",
        });
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  const stack = [];

  function visit(key) {
    if (visiting.has(key)) {
      const index = stack.indexOf(key);
      const cycle = [...stack.slice(Math.max(0, index)), key];
      if (!cycles.some((item) => item.join("|") === cycle.join("|"))) cycles.push(cycle);
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const dep of adjacency.get(key) || []) visit(dep);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  }

  for (const key of adjacency.keys()) visit(key);

  return {
    missing,
    blocked,
    cycles,
    healthy: missing.length === 0 && blocked.length === 0 && cycles.length === 0,
  };
}

function gateScore(state) {
  switch (String(state || "pending").toLowerCase()) {
    case "pass": return 100;
    case "waived": return 70;
    case "pending": return 35;
    case "fail": return 0;
    default: return 0;
  }
}

function deliveryScore(workstreams) {
  if (!workstreams.length) return 0;
  const total = workstreams.reduce((sum, item) => {
    const rank = Math.max(0, stageRank(item.stage));
    return sum + Math.round((rank / STAGE_ORDER.closed) * 100);
  }, 0);
  return Math.round(total / workstreams.length);
}

function averageGateScore(gates) {
  return gates.length
    ? Math.round(gates.reduce((sum, gate) => sum + gateScore(gate.state), 0) / gates.length)
    : 0;
}

function applyLiveProductionGateEvidence(gates, liveStatus) {
  const liveById = new Map((liveStatus?.releaseTruth?.gates || []).map((gate) => [gate.id, gate]));
  return gates.map((gate) => {
    const key = String(gate.gate_key || "").toLowerCase();
    if (!PRODUCTION_ONLY_GATE_KEYS.has(key)) return gate;
    const live = liveById.get(key);
    if (!live) return gate;
    return {
      ...gate,
      state: live.state,
      detail: live.detail,
      evidence: {
        ...(gate.evidence || {}),
        source: "live_release_truth",
        live_state: live.state,
        live_detail: live.detail,
      },
    };
  });
}

export function computeReleaseScorecard({ release, workstreams = [], items = [], gates = [], liveStatus = null }) {
  const dependency = analyzeWorkstreamDependencies(workstreams);
  const openCriticalItems = items.filter((item) =>
    ["p0", "p1"].includes(String(item.priority || "").toLowerCase()) &&
    stageRank(item.stage) < STAGE_ORDER.closed,
  );
  const effectiveGates = applyLiveProductionGateEvidence(gates, liveStatus);
  const gateByKey = new Map(effectiveGates.map((gate) => [String(gate.gate_key || "").toLowerCase(), gate]));
  const missingRcStandardGates = [...RC_STANDARD_GATE_KEYS].filter((key) => !gateByKey.has(key));
  const missingProductionStandardGates = [...PRODUCTION_STANDARD_GATE_KEYS].filter((key) => !gateByKey.has(key));

  const requiredGates = effectiveGates.filter((gate) => gate.required !== false);
  const rcRequiredGates = requiredGates.filter((gate) => !PRODUCTION_ONLY_GATE_KEYS.has(String(gate.gate_key || "").toLowerCase()));
  const productionRequiredGates = requiredGates;

  const rcFailures = rcRequiredGates.filter((gate) => gate.state === "fail");
  const rcPending = rcRequiredGates.filter((gate) => gate.state === "pending");
  const rcWaived = rcRequiredGates.filter((gate) => gate.state === "waived");
  const productionFailures = productionRequiredGates.filter((gate) => gate.state === "fail");
  const productionPending = productionRequiredGates.filter((gate) => gate.state === "pending");
  const productionWaived = productionRequiredGates.filter((gate) => gate.state === "waived");
  const illegalWaivers = productionWaived.filter((gate) => !isControlTowerGateWaivable(gate.gate_key));

  const gatesScore = averageGateScore(rcRequiredGates);
  const delivery = deliveryScore(workstreams);
  const dependencyScore = dependency.healthy ? 100 : Math.max(0, 100 - dependency.missing.length * 20 - dependency.blocked.length * 10 - dependency.cycles.length * 30);
  const blockerScore = Math.max(0, 100 - openCriticalItems.filter((item) => item.priority === "p0").length * 40 - openCriticalItems.filter((item) => item.priority === "p1").length * 20);
  const productionEvidence = liveStatus?.releaseTruth?.productionVerified ? 100 : liveStatus?.releaseTruth?.exactSha ? 60 : 20;

  // Overall is Release Candidate readiness. Production-only identity evidence is intentionally
  // separated so a Preview can become a valid RC without pretending to be Production.
  const overall = Math.round(
    delivery * 0.25 + gatesScore * 0.35 + dependencyScore * 0.2 + blockerScore * 0.2,
  );

  const hardBlockers = [];
  if (missingRcStandardGates.length) hardBlockers.push(`${missingRcStandardGates.length} RC standard gate(s) missing`);
  if (rcFailures.length) hardBlockers.push(`${rcFailures.length} RC-required gate(s) failed`);
  if (rcPending.length) hardBlockers.push(`${rcPending.length} RC-required gate(s) pending`);
  if (rcWaived.length) hardBlockers.push(`${rcWaived.length} RC-required gate(s) waived`);
  if (openCriticalItems.some((item) => item.priority === "p0")) hardBlockers.push("Open P0 item exists");
  if (dependency.missing.length) hardBlockers.push("Missing workstream dependency exists");
  if (dependency.cycles.length) hardBlockers.push("Dependency cycle exists");
  if (!workstreams.length) hardBlockers.push("No workstreams registered");

  const productionBlockers = [...hardBlockers];
  if (missingProductionStandardGates.length) productionBlockers.push(`${missingProductionStandardGates.length} Production standard gate(s) missing`);
  if (productionFailures.length) productionBlockers.push(`${productionFailures.length} Production-required gate(s) failed`);
  if (productionPending.length) productionBlockers.push(`${productionPending.length} Production-required gate(s) pending`);
  if (productionWaived.length) productionBlockers.push(`${productionWaived.length} Production-required gate(s) waived`);
  if (illegalWaivers.length) productionBlockers.push(`${illegalWaivers.length} non-waivable gate(s) marked waived`);
  if (!liveStatus?.releaseTruth?.productionVerified) productionBlockers.push("Production exact-SHA runtime evidence is not verified");

  const rcEligible = overall >= 90 && hardBlockers.length === 0;
  const productionEligible = rcEligible && productionBlockers.length === 0;

  return {
    releaseId: release?.id || null,
    overall,
    dimensions: {
      delivery,
      releaseGates: gatesScore,
      dependencyHealth: dependencyScore,
      criticalBlockers: blockerScore,
      productionEvidence,
    },
    gateCoverage: {
      rcStandardRequired: RC_STANDARD_GATE_KEYS.size,
      rcStandardPresent: RC_STANDARD_GATE_KEYS.size - missingRcStandardGates.length,
      missingRcStandard: missingRcStandardGates,
      productionStandardRequired: PRODUCTION_STANDARD_GATE_KEYS.size,
      productionStandardPresent: PRODUCTION_STANDARD_GATE_KEYS.size - missingProductionStandardGates.length,
      missingProductionStandard: missingProductionStandardGates,
      required: requiredGates.length,
      pass: requiredGates.filter((gate) => gate.state === "pass").length,
      fail: productionFailures.length,
      pending: productionPending.length,
      waived: productionWaived.length,
      illegalWaivers: illegalWaivers.map((gate) => gate.gate_key),
    },
    effectiveProductionGates: effectiveGates
      .filter((gate) => PRODUCTION_ONLY_GATE_KEYS.has(String(gate.gate_key || "").toLowerCase()))
      .map((gate) => ({ gate_key: gate.gate_key, state: gate.state, detail: gate.detail })),
    openCriticalItems: openCriticalItems.map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      stage: item.stage,
    })),
    dependency,
    hardBlockers,
    productionBlockers,
    rcEligible,
    productionEligible,
  };
}
