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
const RELEASE_INITIAL_STAGE_SET = new Set(["idea", "planned"]);
const WORKSTREAM_INITIAL_STAGE_SET = new Set(["idea", "planned", "ready"]);
const ITEM_INITIAL_STAGE_SET = new Set(["idea", "planned", "ready", "in_progress"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, max = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function optionalText(value, max = 4000) {
  const normalized = text(value, max);
  return normalized || null;
}

function uuid(value) {
  const normalized = text(value, 80).toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function platforms(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
}

function dependencies(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 100).toLowerCase()).filter(Boolean))].slice(0, 30);
}

function date(value) {
  const normalized = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

function boundedJson(value, depth = 0) {
  if (depth > 6) return "[max-depth]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => boundedJson(item, depth + 1));
  if (!value || typeof value !== "object") return {};

  const out = {};
  for (const [rawKey, entry] of Object.entries(value).slice(0, 100)) {
    const key = text(rawKey, 120);
    if (!key) continue;
    out[key] = boundedJson(entry, depth + 1);
  }
  return out;
}

function expectedTimestamp(value) {
  const normalized = text(value, 80);
  if (!normalized) return null;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export function isControlTowerUuid(value) {
  return Boolean(uuid(value));
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
  if (!RELEASE_INITIAL_STAGE_SET.has(stage)) return { ok: false, error: "New releases must begin at idea or planned." };
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
      target_date: source.targetDate ? date(source.targetDate) : null,
    },
  };
}

export function validateControlTowerReleasePatchInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = uuid(source.id);
  if (!id) return { ok: false, error: "A valid release id is required." };
  if (hasOwn(source, "stage")) return { ok: false, error: "Release stage must be changed through the governed promotion endpoint." };

  const patch = {};
  if (hasOwn(source, "releaseStatus")) {
    const value = text(source.releaseStatus, 24).toLowerCase();
    if (!RELEASE_STATUS_SET.has(value)) return { ok: false, error: "Invalid release status." };
    patch.release_status = value;
  }
  if (hasOwn(source, "capabilityLayer")) patch.capability_layer = optionalText(source.capabilityLayer, 120);
  if (hasOwn(source, "releaseNotes")) patch.release_notes = optionalText(source.releaseNotes, 8000);
  if (hasOwn(source, "targetPlatforms")) patch.target_platforms = platforms(source.targetPlatforms);
  if (hasOwn(source, "targetDate")) {
    if (source.targetDate && !date(source.targetDate)) return { ok: false, error: "Invalid target date." };
    patch.target_date = source.targetDate ? date(source.targetDate) : null;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "No release fields to update." };

  const expectedUpdatedAt = expectedTimestamp(source.expectedUpdatedAt);
  if (source.expectedUpdatedAt && !expectedUpdatedAt) return { ok: false, error: "Invalid expectedUpdatedAt timestamp." };
  return { ok: true, id, patch, expectedUpdatedAt };
}

export function validateControlTowerWorkstreamInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = uuid(source.releaseId);
  const workstreamKey = text(source.workstreamKey, 80).toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const name = text(source.name, 160);
  const stage = text(source.stage, 40).toLowerCase() || "planned";

  if (!releaseId) return { ok: false, error: "A valid release id is required." };
  if (!workstreamKey) return { ok: false, error: "Workstream key is required." };
  if (!name) return { ok: false, error: "Workstream name is required." };
  if (!WORKSTREAM_INITIAL_STAGE_SET.has(stage)) return { ok: false, error: "New workstreams must begin at idea, planned, or ready." };

  return {
    ok: true,
    value: {
      release_id: releaseId,
      workstream_key: workstreamKey,
      name,
      description: optionalText(source.description, 4000),
      stage,
      dependencies: dependencies(source.dependencies),
    },
  };
}

export function validateControlTowerWorkstreamPatchInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = uuid(source.id);
  if (!id) return { ok: false, error: "A valid workstream id is required." };
  const patch = {};
  if (hasOwn(source, "name")) {
    const value = text(source.name, 160);
    if (!value) return { ok: false, error: "Workstream name cannot be empty." };
    patch.name = value;
  }
  if (hasOwn(source, "description")) patch.description = optionalText(source.description, 4000);
  if (hasOwn(source, "dependencies")) patch.dependencies = dependencies(source.dependencies);
  if (hasOwn(source, "stage")) {
    const value = text(source.stage, 40).toLowerCase();
    if (!STAGE_SET.has(value)) return { ok: false, error: "Invalid workstream stage." };
    patch.stage = value;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "No workstream fields to update." };
  const expectedUpdatedAt = expectedTimestamp(source.expectedUpdatedAt);
  if (source.expectedUpdatedAt && !expectedUpdatedAt) return { ok: false, error: "Invalid expectedUpdatedAt timestamp." };
  return { ok: true, id, patch, expectedUpdatedAt };
}

export function validateControlTowerItemInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = uuid(source.releaseId);
  const workstreamId = source.workstreamId ? uuid(source.workstreamId) : null;
  const itemType = text(source.itemType, 40).toLowerCase();
  const title = text(source.title, 240);
  const stage = text(source.stage, 40).toLowerCase() || "planned";
  const priority = text(source.priority, 8).toLowerCase() || "p2";

  if (!releaseId) return { ok: false, error: "A valid release id is required." };
  if (source.workstreamId && !workstreamId) return { ok: false, error: "Invalid workstream id." };
  if (!ITEM_TYPE_SET.has(itemType)) return { ok: false, error: "Invalid item type." };
  if (itemType === "evidence") return { ok: false, error: "Evidence must be registered through the dedicated evidence endpoint." };
  if (!title) return { ok: false, error: "Item title is required." };
  if (!ITEM_INITIAL_STAGE_SET.has(stage)) return { ok: false, error: "New items must begin before code-complete verification stages." };
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
      metadata: boundedJson(source.metadata),
    },
  };
}

export function validateControlTowerItemPatchInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = uuid(source.id);
  if (!id) return { ok: false, error: "A valid item id is required." };
  const patch = {};
  if (hasOwn(source, "title")) {
    const value = text(source.title, 240);
    if (!value) return { ok: false, error: "Item title cannot be empty." };
    patch.title = value;
  }
  if (hasOwn(source, "description")) patch.description = optionalText(source.description, 6000);
  if (hasOwn(source, "externalRef")) patch.external_ref = optionalText(source.externalRef, 500);
  if (hasOwn(source, "metadata")) patch.metadata = boundedJson(source.metadata);
  if (hasOwn(source, "priority")) {
    const value = text(source.priority, 8).toLowerCase();
    if (!PRIORITY_SET.has(value)) return { ok: false, error: "Invalid item priority." };
    patch.priority = value;
  }
  if (hasOwn(source, "stage")) {
    const value = text(source.stage, 40).toLowerCase();
    if (!STAGE_SET.has(value)) return { ok: false, error: "Invalid item stage." };
    patch.stage = value;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "No item fields to update." };
  const expectedUpdatedAt = expectedTimestamp(source.expectedUpdatedAt);
  if (source.expectedUpdatedAt && !expectedUpdatedAt) return { ok: false, error: "Invalid expectedUpdatedAt timestamp." };
  return { ok: true, id, patch, expectedUpdatedAt };
}

export function validateControlTowerGateInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = uuid(source.releaseId);
  const gateKey = text(source.gateKey, 100).toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const label = text(source.label, 180);
  const state = text(source.state, 24).toLowerCase() || "pending";
  const detail = optionalText(source.detail, 5000);

  if (!releaseId) return { ok: false, error: "A valid release id is required." };
  if (!gateKey) return { ok: false, error: "Gate key is required." };
  if (!label) return { ok: false, error: "Gate label is required." };
  if (!GATE_STATE_SET.has(state)) return { ok: false, error: "Invalid gate state." };
  if (state === "waived" && !detail) return { ok: false, error: "Waived gates require a documented reason." };

  return {
    ok: true,
    value: {
      release_id: releaseId,
      gate_key: gateKey,
      label,
      state,
      required: source.required !== false,
      detail,
      evidence: boundedJson(source.evidence),
    },
  };
}

export function isControlTowerStorageMissing(error) {
  return Boolean(error && ["42P01", "PGRST205", "PGRST204"].includes(error.code));
}
