export const CONTROL_TOWER_STAGES = Object.freeze([
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

export const CONTROL_TOWER_RELEASE_STATUSES = Object.freeze([
  "active",
  "next",
  "backlog",
  "archived",
]);

export const CONTROL_TOWER_ITEM_TYPES = Object.freeze([
  "epic",
  "feature",
  "task",
  "pr",
  "dependency",
  "risk",
  "decision",
  "deprecation",
  "evidence",
]);

export const CONTROL_TOWER_PRIORITIES = Object.freeze(["p0", "p1", "p2", "p3"]);
export const CONTROL_TOWER_GATE_STATES = Object.freeze(["pending", "pass", "fail", "waived"]);

const STAGE_SET = new Set(CONTROL_TOWER_STAGES);
const RELEASE_STATUS_SET = new Set(CONTROL_TOWER_RELEASE_STATUSES);
const ITEM_TYPE_SET = new Set(CONTROL_TOWER_ITEM_TYPES);
const PRIORITY_SET = new Set(CONTROL_TOWER_PRIORITIES);
const GATE_STATE_SET = new Set(CONTROL_TOWER_GATE_STATES);

function text(value, max = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function optionalText(value, max = 4000) {
  const normalized = text(value, max);
  return normalized || null;
}

function platforms(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
}

function date(value) {
  const normalized = text(value, 10);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export function validateControlTowerReleaseInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const productVersion = text(source.productVersion, 80);
  const releaseVersion = text(source.releaseVersion, 80);
  const releaseStatus = text(source.releaseStatus, 24).toLowerCase() || "backlog";
  const stage = text(source.stage, 40).toLowerCase() || "planned";

  if (!productVersion) return { ok: false, error: "Product version is required." };
  if (!releaseVersion) return { ok: false, error: "Release version is required." };
  if (!RELEASE_STATUS_SET.has(releaseStatus)) return { ok: false, error: "Invalid release status." };
  if (!STAGE_SET.has(stage)) return { ok: false, error: "Invalid release stage." };
  if (source.targetDate && !date(source.targetDate)) return { ok: false, error: "Invalid target date." };

  return {
    ok: true,
    value: {
      product_version: productVersion,
      release_version: releaseVersion,
      capability_layer: optionalText(source.capabilityLayer, 120),
      release_status: releaseStatus,
      stage,
      target_platforms: platforms(source.targetPlatforms),
      release_notes: optionalText(source.releaseNotes, 8000),
      target_date: date(source.targetDate),
    },
  };
}

export function validateControlTowerWorkstreamInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = text(source.releaseId, 80);
  const workstreamKey = text(source.workstreamKey, 80).toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const name = text(source.name, 160);
  const stage = text(source.stage, 40).toLowerCase() || "planned";

  if (!releaseId) return { ok: false, error: "Release is required." };
  if (!workstreamKey) return { ok: false, error: "Workstream key is required." };
  if (!name) return { ok: false, error: "Workstream name is required." };
  if (!STAGE_SET.has(stage)) return { ok: false, error: "Invalid workstream stage." };

  const dependencies = Array.isArray(source.dependencies)
    ? [...new Set(source.dependencies.map((item) => text(item, 100)).filter(Boolean))].slice(0, 30)
    : [];

  return {
    ok: true,
    value: {
      release_id: releaseId,
      workstream_key: workstreamKey,
      name,
      description: optionalText(source.description, 4000),
      stage,
      dependencies,
    },
  };
}

export function validateControlTowerItemInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = text(source.releaseId, 80);
  const workstreamId = text(source.workstreamId, 80) || null;
  const itemType = text(source.itemType, 40).toLowerCase();
  const title = text(source.title, 240);
  const stage = text(source.stage, 40).toLowerCase() || "planned";
  const priority = text(source.priority, 8).toLowerCase() || "p2";

  if (!releaseId) return { ok: false, error: "Release is required." };
  if (!ITEM_TYPE_SET.has(itemType)) return { ok: false, error: "Invalid item type." };
  if (!title) return { ok: false, error: "Item title is required." };
  if (!STAGE_SET.has(stage)) return { ok: false, error: "Invalid item stage." };
  if (!PRIORITY_SET.has(priority)) return { ok: false, error: "Invalid item priority." };

  return {
    ok: true,
    value: {
      release_id: releaseId,
      workstream_id: workstreamId,
      item_type: itemType,
      title,
      description: optionalText(source.description, 6000),
      stage,
      priority,
      external_ref: optionalText(source.externalRef, 500),
      metadata: object(source.metadata),
    },
  };
}

export function validateControlTowerGateInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = text(source.releaseId, 80);
  const gateKey = text(source.gateKey, 100).toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const label = text(source.label, 180);
  const state = text(source.state, 24).toLowerCase() || "pending";

  if (!releaseId) return { ok: false, error: "Release is required." };
  if (!gateKey) return { ok: false, error: "Gate key is required." };
  if (!label) return { ok: false, error: "Gate label is required." };
  if (!GATE_STATE_SET.has(state)) return { ok: false, error: "Invalid gate state." };

  return {
    ok: true,
    value: {
      release_id: releaseId,
      gate_key: gateKey,
      label,
      state,
      required: source.required !== false,
      detail: optionalText(source.detail, 5000),
      evidence: object(source.evidence),
    },
  };
}

export function isControlTowerStorageMissing(error) {
  return Boolean(error && ["42P01", "PGRST205", "PGRST204"].includes(error.code));
}
