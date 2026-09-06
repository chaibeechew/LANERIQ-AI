import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { evaluateControlTowerProductionDrift } from "../../../../../lib/control-tower-snapshot.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim() || null;
    const [{ data: auditRows, error: auditError }, liveStatus] = await Promise.all([
      auth.supabase.rpc("verify_control_tower_audit_chain"),
      getControlTowerLiveStatus(),
    ]);

    if (auditError) {
      if (isControlTowerStorageMissing(auditError) || auditError.code === "42883") {
        return controlTowerJson({ storageReady: false, auditIntegrity: null, productionDrift: null });
      }
      throw auditError;
    }

    const auditIntegrity = Array.isArray(auditRows) ? auditRows[0] || null : auditRows || null;
    let release = null;
    if (releaseId) {
      const { data, error } = await auth.supabase
        .from("control_tower_releases")
        .select("id,release_version,release_status,stage,production_verified_at,production_truth,updated_at")
        .eq("id", releaseId)
        .maybeSingle();
      if (error) {
        if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, auditIntegrity, productionDrift: null });
        throw error;
      }
      if (!data) return controlTowerJson({ error: "Release not found." }, 404);
      release = data;
    }

    const productionDrift = release
      ? evaluateControlTowerProductionDrift(release.production_truth, liveStatus)
      : null;

    return controlTowerJson({
      storageReady: true,
      auditIntegrity,
      release,
      productionDrift,
      live: {
        repository: liveStatus.repository,
        githubMainSha: liveStatus.github?.mainSha || null,
        ciState: liveStatus.github?.ciState || "unknown",
        runtimeSha: liveStatus.runtime?.commitSha || null,
        environment: liveStatus.runtime?.environment || "unknown",
        productionVerified: Boolean(liveStatus.releaseTruth?.productionVerified),
      },
    });
  } catch {
    return controlTowerJson({ error: "Unable to evaluate Control Tower integrity." }, 500);
  }
}
