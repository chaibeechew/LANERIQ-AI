export const CONTROL_TOWER_STAGE_SEQUENCE = Object.freeze([
  "idea",
  "planned",
  "ready",
  "in_progress",
  "code_complete",
  "verification",
  "release_candidate",
  "production",
  "observed",
  "closed",
]);

const INDEX = new Map(CONTROL_TOWER_STAGE_SEQUENCE.map((stage, index) => [stage, index]));

export function normalizeControlTowerStage(stage) {
  const value = typeof stage === "string" ? stage.trim().toLowerCase() : "";
  return INDEX.has(value) ? value : null;
}

export function canTransitionControlTowerStage(fromStage, toStage) {
  const from = normalizeControlTowerStage(fromStage);
  const to = normalizeControlTowerStage(toStage);
  if (!from || !to) return false;
  if (from === to) return true;
  const fromIndex = INDEX.get(from);
  const toIndex = INDEX.get(to);
  if (toIndex === fromIndex + 1) return true;
  if (toIndex === fromIndex - 1 && !["production", "observed", "closed"].includes(from)) return true;
  return false;
}

export function isControlTowerReleaseFrozen(stage) {
  const normalized = normalizeControlTowerStage(stage);
  return ["release_candidate", "production", "observed", "closed"].includes(normalized);
}

export function promotionRequirement(targetStage) {
  const target = normalizeControlTowerStage(targetStage);
  if (target === "release_candidate") return "rc";
  if (target === "production") return "production";
  return "standard";
}

export function evaluatePromotionPolicy({ currentStage, targetStage, scorecard }) {
  const current = normalizeControlTowerStage(currentStage);
  const target = normalizeControlTowerStage(targetStage);
  if (!current || !target) return { allowed: false, reason: "Invalid release stage." };
  if (!canTransitionControlTowerStage(current, target)) {
    return { allowed: false, reason: `Transition ${current} → ${target} is not allowed.` };
  }
  if (target === "release_candidate" && !scorecard?.rcEligible) {
    return { allowed: false, reason: "Release Candidate promotion requires readiness >= 90 with no hard blockers or waived required gates." };
  }
  if (target === "production" && !scorecard?.productionEligible) {
    return { allowed: false, reason: "Production promotion requires RC readiness plus verified Production exact-SHA evidence." };
  }
  return { allowed: true, reason: null };
}
