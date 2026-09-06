import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { computeControlTowerOperationalResilience } from "../../../../../lib/control-tower-resilience.js";
import { isControlTowerStorageMissing, isControlTowerUuid } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadReleaseBundle(supabase, releaseId) {
  const [releaseResult, itemResult, gateResult] = await Promise.all([
    supabase.from("control_tower_releases").select("id,product_version,release_version,release_status,stage,target_platforms,target_date,updated_at").eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_items").select("id,release_id,item_type,title,stage,priority,external_ref,metadata,created_at,updated_at").eq("release_id", releaseId).order("created_at", { ascending: false }),
    supabase.from("control_tower_release_gates").select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at").eq("release_id", releaseId).order("created_at", { ascending: true }),
  ]);
  for (const result of [releaseResult, itemResult, gateResult]) {
    if (result.error) throw result.error;
  }
  return { release: releaseResult.data, items: itemResult.data || [], gates: gateResult.data || [] };
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim().toLowerCase() || "";
    if (!isControlTowerUuid(releaseId)) return controlTowerJson({ error: "A valid releaseId is required." }, 400);

    let bundle;
    try {
      bundle = await loadReleaseBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) {
        return controlTowerJson({ storageReady: false, resilience: null, capabilities: auth.capabilities }, 503);
      }
      throw error;
    }
    if (!bundle.release) return controlTowerJson({ error: "Release not found." }, 404);

    const liveStatus = await getControlTowerLiveStatus();
    const resilience = computeControlTowerOperationalResilience({ ...bundle, liveStatus });
    return controlTowerJson({ storageReady: true, release: bundle.release, liveStatus, resilience, capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to evaluate operational resilience." }, 500);
  }
}
