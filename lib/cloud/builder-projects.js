import { createBuilderProjectDataAdapter } from "../cloud-adapters/builder-project-world-data.js";

// Adapter stack: builder-project-world-data.js composes cloud-adapters/builder-project-data.js so legacy provider/security contracts remain independently testable while World persistence overrides only Generate/Modify.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function getAdapter() {
  return createBuilderProjectDataAdapter();
}

function fail(code, detail = null) {
  return Object.freeze({ ok: false, code, detail });
}

export async function getBuilderPrincipal({ requireVerified = false } = {}) {
  const result = await getAdapter().currentPrincipal({ requireVerified });
  if (!result?.ok) return fail(result?.code || "AUTHENTICATION_REQUIRED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal });
}

export async function loadBuilderGenerationReplay({ requestId }) {
  const id = String(requestId || "").trim();
  if (!REQUEST_ID.test(id)) return fail("GENERATION_REQUEST_INVALID");
  const result = await getAdapter().loadGenerationReplay({ requestId: id });
  if (!result?.ok) return fail(result?.code || "GENERATION_REPLAY_LOOKUP_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, app: result.app || null, version: result.version || null, memory: result.memory || null });
}

export async function loadBuilderGenerationInputs({ assetIds = [] } = {}) {
  const ids = Array.isArray(assetIds) ? assetIds.map((value) => String(value || "").trim()).filter((value) => UUID.test(value)).slice(0, 20) : [];
  const result = await getAdapter().loadGenerationInputs({ assetIds: ids });
  if (!result?.ok) return fail(result?.code || "GENERATION_INPUTS_UNAVAILABLE", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, brandKit: result.brandKit || null, builderAccess: result.builderAccess, ownedAssets: result.ownedAssets || [] });
}

export async function loadBuilderGameCapacityContext({ appId }) {
  const id = String(appId || "").trim();
  if (!UUID.test(id)) return fail("PROJECT_NOT_FOUND");
  const result = await getAdapter().loadGameCapacityContext({ appId: id });
  if (!result?.ok) return fail(result?.code || "GAME_CAPACITY_CONTEXT_UNAVAILABLE", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, builderAccess: result.builderAccess, project: result.project, version: result.version });
}

export async function persistBuilderGeneratedProject(payload) {
  const requestId = String(payload?.requestId || "").trim();
  if (!REQUEST_ID.test(requestId)) return fail("GENERATION_REQUEST_INVALID");
  const result = await getAdapter().persistGeneratedProject({
    requestId,
    name: String(payload?.name || "Untitled App").trim(),
    description: String(payload?.description || "").trim(),
    sourcePrompt: String(payload?.sourcePrompt || ""),
    specification: payload?.specification || {},
    changeSummary: String(payload?.changeSummary || "Initial verified build"),
    memoryJson: payload?.memoryJson || {},
    learningScope: String(payload?.learningScope || "project_only"),
  });
  if (!result?.ok) return fail(result?.code || "GENERATED_PROJECT_PERSIST_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, persisted: result.persisted });
}

export async function saveBuilderGeneratedProjectContext({ projectId, assignments = [], memoryJson, learningScope = "project_only" }) {
  const id = String(projectId || "").trim();
  if (!UUID.test(id)) return fail("PROJECT_NOT_FOUND");
  const result = await getAdapter().saveGeneratedProjectContext({ projectId: id, assignments, memoryJson, learningScope });
  if (!result?.ok) return fail(result?.code || "PROJECT_CONTEXT_SAVE_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, mediaSaved: result.mediaSaved, memorySaved: result.memorySaved });
}

export async function loadBuilderModificationContext({ appId, requestId }) {
  const projectId = String(appId || "").trim();
  const stableRequestId = String(requestId || "").trim();
  if (!UUID.test(projectId)) return fail("PROJECT_NOT_FOUND");
  if (!REQUEST_ID.test(stableRequestId)) return fail("MODIFICATION_REQUEST_INVALID");
  const result = await getAdapter().loadModificationContext({ appId: projectId, requestId: stableRequestId });
  if (!result?.ok) return fail(result?.code || "MODIFICATION_CONTEXT_UNAVAILABLE", result?.detail || null);
  return Object.freeze({
    ok: true,
    principal: result.principal,
    project: result.project,
    replayVersion: result.replayVersion || null,
    currentVersion: result.currentVersion || null,
    memory: result.memory || null,
  });
}

export async function saveBuilderModification(payload) {
  const appId = String(payload?.appId || "").trim();
  const expectedVersionId = String(payload?.expectedVersionId || "").trim();
  const requestId = String(payload?.requestId || "").trim();
  if (!UUID.test(appId) || !UUID.test(expectedVersionId)) return fail("PROJECT_VERSION_NOT_FOUND");
  if (!REQUEST_ID.test(requestId)) return fail("MODIFICATION_REQUEST_INVALID");
  const result = await getAdapter().saveModification({
    appId,
    expectedVersionId,
    requestId,
    specification: payload?.specification || {},
    changeSummary: String(payload?.changeSummary || "AI modification"),
    memoryJson: payload?.memoryJson || {},
    learningScope: String(payload?.learningScope || "project_only"),
  });
  if (!result?.ok) return fail(result?.code || "MODIFICATION_SAVE_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, version: result.version, replayed: result.replayed, memorySaved: result.memorySaved, worldMemoryAtomic: result.worldMemoryAtomic === true });
}

export async function loadBuilderPublishPreparation({ appId, versionId, listingId }) {
  const ids = [appId, versionId, listingId].map((value) => String(value || "").trim());
  if (ids.some((value) => !UUID.test(value))) return fail("PUBLISH_CONTEXT_INVALID");
  const result = await getAdapter().loadPublishPreparation({ appId: ids[0], versionId: ids[1], listingId: ids[2] });
  if (!result?.ok) return fail(result?.code || "PUBLISH_CONTEXT_UNAVAILABLE", result?.detail || null);
  return Object.freeze({
    ok: true,
    principal: result.principal,
    project: result.project,
    version: result.version,
    listing: result.listing,
    projectAssets: result.projectAssets || [],
    library: result.library || [],
    memory: result.memory || null,
  });
}

export async function createBuilderStorePublishRequest(payload) {
  const appId = String(payload?.appId || "").trim();
  const versionId = String(payload?.versionId || "").trim();
  const listingId = String(payload?.listingId || "").trim();
  const requestId = String(payload?.requestId || "").trim();
  if (![appId, versionId, listingId].every((value) => UUID.test(value))) return fail("PUBLISH_CONTEXT_INVALID");
  if (!REQUEST_ID.test(requestId)) return fail("PUBLISH_REQUEST_INVALID");
  const result = await getAdapter().createStorePublishRequest({ appId, versionId, listingId, platform: payload?.platform, requestId });
  if (!result?.ok) return fail(result?.code || "STORE_PUBLISH_REQUEST_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, request: result.request });
}

export async function saveBuilderStoreListing(payload) {
  const appId = String(payload?.appId || "").trim();
  const versionId = String(payload?.versionId || "").trim();
  if (!UUID.test(appId) || !UUID.test(versionId)) return fail("PROJECT_VERSION_NOT_FOUND");
  const result = await getAdapter().saveStoreListing({ appId, versionId, language: payload?.language, normalized: payload?.normalized });
  if (!result?.ok) return fail(result?.code || "STORE_LISTING_SAVE_FAILED", result?.detail || null);
  return Object.freeze({ ok: true, principal: result.principal, listing: result.listing });
}

export function publicBuilderProjectCloudBoundary() {
  return Object.freeze({
    providerOpaqueRouteLayer: true,
    compatibilityAdapterBoundary: true,
    generateMigrated: true,
    generatedProjectPersistenceMigrated: true,
    modifyMigrated: true,
    worldEvidenceAtomicPersistence: true,
    gameCapacityContextMigrated: true,
    storePublishRequestMigrated: true,
    storeMetadataSaveMigrated: true,
    providerAdaptersFullyMigrated: false,
  });
}
