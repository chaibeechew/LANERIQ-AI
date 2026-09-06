import { createProductionEvidenceDataAdapter } from "../cloud-adapters/production-evidence-data.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(code) {
  return Object.freeze({ ok: false, code });
}

export async function getOwnedProductionEvidenceProject({ userId, projectId }) {
  const ownerId = String(userId || "").trim();
  const id = String(projectId || "").trim();
  if (!UUID.test(ownerId) || !UUID.test(id)) return fail("PROJECT_NOT_FOUND");

  const result = await createProductionEvidenceDataAdapter().getOwnedProjectSnapshot({
    userId: ownerId,
    projectId: id,
  });
  if (!result?.ok) return fail(result?.code || "PROJECT_NOT_FOUND");
  return Object.freeze({ ok: true, project: result.project });
}

export function productionEvidenceCloudBoundary() {
  return Object.freeze({
    providerOpaqueRouteLayer: true,
    laneriqSessionAuthorityRequired: true,
    explicitOwnerIsolation: true,
    privilegedReadScopedByOwnerAndProject: true,
    providerAdapterReplaceable: true,
    persistentAuditStorageLive: false,
  });
}
