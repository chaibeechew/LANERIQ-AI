import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { computeReleaseScorecard } from "../../../../../lib/control-tower-governance.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { buildControlTowerReleaseSnapshot } from "../../../../../lib/control-tower-snapshot.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadBundle(supabase, releaseId) {
  const [releaseResult, workstreamsResult, itemsResult, gatesResult] = await Promise.all([
    supabase.from("control_tower_releases").select("id,product_version,release_version,capability_layer,release_status,stage,target_platforms,target_date,production_verified_at,production_truth,updated_at").eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_workstreams").select("id,release_id,workstream_key,name,stage,dependencies,updated_at").eq("release_id", releaseId),
    supabase.from("control_tower_items").select("id,release_id,workstream_id,item_type,title,stage,priority,external_ref,metadata,updated_at").eq("release_id", releaseId),
    supabase.from("control_tower_release_gates").select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at").eq("release_id", releaseId),
  ]);
  for (const result of [releaseResult, workstreamsResult, itemsResult, gatesResult]) {
    if (result.error) throw result.error;
  }
  return {
    release: releaseResult.data,
    workstreams: workstreamsResult.data || [],
    items: itemsResult.data || [],
    gates: gatesResult.data || [],
  };
}

function safeFileName(value) {
  return String(value || "release").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "release";
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    if (!releaseId) return controlTowerJson({ error: "releaseId is required." }, 400);

    let bundle;
    try {
      bundle = await loadBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, snapshot: null });
      throw error;
    }
    if (!bundle.release) return controlTowerJson({ error: "Release not found." }, 404);

    const liveStatus = await getControlTowerLiveStatus();
    const scorecard = computeReleaseScorecard({ ...bundle, liveStatus });
    const snapshot = buildControlTowerReleaseSnapshot({ ...bundle, scorecard, liveStatus });
    const download = request.nextUrl.searchParams.get("download") === "1";
    const headers = download
      ? { "Content-Disposition": `attachment; filename="laneriq-${safeFileName(bundle.release.release_version)}-snapshot.json"` }
      : {};

    return controlTowerJson({ storageReady: true, ...snapshot }, 200, headers);
  } catch {
    return controlTowerJson({ error: "Unable to build Control Tower release snapshot." }, 500);
  }
}
