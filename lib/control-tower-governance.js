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
  { gate_key: "ci", label: "CI / required checks", required: true },
  { gate_key: "security", label: "Security verification", required: true },
  { gate_key: "database", label: "Database / migration verification", required: true },
  { gate_key: "api", label: "API contract verification", required: true },
  { gate_key: "performance", label: "Performance readiness", required: true },
  { gate_key: "accessibility", label: "Accessibility readiness", required: true },
  { gate_key: "mobile", label: "Mobile / safe-area readiness", required: true },
  { gate_key: "billing", label: "Billing / entitlement integrity", required: true },
  { gate_key: "github-main", label: "GitHub main identity", required: true },
  { gate_key: "runtime-identity", label: "Runtime build identity", required: true },
  { gate_key: "exact-sha", label: "GitHub main = Production runtime SHA", required: true },
  { gate_key: "supabase", label: "Supabase runtime verification", required: true },
]);

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
      cycles.push([...stack.slice(index), key]);
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

export function computeReleaseScorecard({ release, workstreams = [], items = [], gates = [], liveStatus = null }) {
  const dependency = analyzeWorkstreamDependencies(workstreams);
  const openCriticalItems = items.filter((item) =>
    ["p0", "p1"].includes(String(item.priority || "").toLowerCase()) &&
    stageRank(item.stage) < STAGE_ORDER.closed,
  );
  const requiredGates = gates.filter((gate) => gate.required !== false);
  const requiredFailures = requiredGates.filter((gate) => gate.state === "fail");
  const requiredPending = requiredGates.filter((gate) => gate.state === "pending");
  const requiredWaived = requiredGates.filter((gate) => gate.state === "waived");

  const gatesScore = requiredGates.length
    ? Math.round(requiredGates.reduce((sum, gate) => sum + gateScore(gate.state), 0) / requiredGates.length)
    : 0;
  const delivery = deliveryScore(workstreams);
  const dependencyScore = dependency.healthy ? 100 : Math.max(0, 100 - dependency.missing.length * 20 - dependency.blocked.length * 10 - dependency.cycles.length * 30);
  const blockerScore = Math.max(0, 100 - openCriticalItems.filter((item) => item.priority === "p0").length * 40 - openCriticalItems.filter((item) => item.priority === "p1").length * 20);
  const productionEvidence = liveStatus?.releaseTruth?.productionVerified ? 100 : liveStatus?.releaseTruth?.exactSha ? 60 : 20;

  const overall = Math.round(
    delivery * 0.2 + gatesScore * 0.35 + dependencyScore * 0.15 + blockerScore * 0.15 + productionEvidence * 0.15,
  );

  const hardBlockers = [];
  if (requiredFailures.length) hardBlockers.push(`${requiredFailures.length} required gate(s) failed`);
  if (requiredPending.length) hardBlockers.push(`${requiredPending.length} required gate(s) pending`);
  if (openCriticalItems.some((item) => item.priority === "p0")) hardBlockers.push("Open P0 item exists");
  if (dependency.missing.length) hardBlockers.push("Missing workstream dependency exists");
  if (dependency.cycles.length) hardBlockers.push("Dependency cycle exists");

  const rcEligible = overall >= 90 && hardBlockers.length === 0 && requiredWaived.length === 0;
  const productionEligible = rcEligible && Boolean(liveStatus?.releaseTruth?.productionVerified);

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
      required: requiredGates.length,
      pass: requiredGates.filter((gate) => gate.state === "pass").length,
      fail: requiredFailures.length,
      pending: requiredPending.length,
      waived: requiredWaived.length,
    },
    openCriticalItems: openCriticalItems.map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      stage: item.stage,
    })),
    dependency,
    hardBlockers,
    rcEligible,
    productionEligible,
  };
}
