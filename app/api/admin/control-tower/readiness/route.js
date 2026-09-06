import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import {
  CONTROL_TOWER_STANDARD_GATES,
  computeReleaseScorecard,
} from "../../../../../lib/control-tower-governance.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

async function loadReleaseBundle(supabase, releaseId) {
  const [releaseResult, workstreamResult, itemResult, gateResult] = await Promise.all([
    supabase.from("control_tower_releases").select("id,product_version,release_version,release_status,stage,target_platforms,target_date,production_verified_at,production_truth,updated_at").eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_workstreams").select("id,release_id,workstream_key,name,stage,dependencies,updated_at").eq("release_id", releaseId).order("created_at", { ascending: true }),
    supabase.from("control_tower_items").select("id,release_id,workstream_id,item_type,title,stage,priority,external_ref,metadata,updated_at").eq("release_id", releaseId).order("created_at", { ascending: false }),
    supabase.from("control_tower_release_gates").select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at").eq("release_id", releaseId).order("created_at", { ascending: true }),
  ]);
  for (const result of [releaseResult, workstreamResult, itemResult, gateResult]) {
    if (result.error) throw result.error;
  }
  return {
    release: releaseResult.data,
    workstreams: workstreamResult.data || [],
    items: itemResult.data || [],
    gates: gateResult.data || [],
  };
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;
    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    if (!releaseId) return controlTowerJson({ error: "releaseId is required." }, 400);

    let bundle;
    try {
      bundle = await loadReleaseBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, scorecard: null, capabilities: auth.capabilities });
      throw error;
    }
    if (!bundle.release) return controlTowerJson({ error: "Release not found." }, 404);

    const liveStatus = await getControlTowerLiveStatus();
    const scorecard = computeReleaseScorecard({ ...bundle, liveStatus });
    return controlTowerJson({
      storageReady: true,
      ...bundle,
      liveStatus,
      scorecard,
      capabilities: auth.capabilities,
    });
  } catch {
    return controlTowerJson({ error: "Unable to evaluate release readiness." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;
    if (!auth.capabilities.initializeGates) {
      return controlTowerJson({ error: "Gate initialization is not permitted for this role." }, 403);
    }

    const input = await request.json().catch(() => ({}));
    const releaseId = typeof input.releaseId === "string" ? input.releaseId.trim() : "";
    if (!releaseId) return controlTowerJson({ error: "releaseId is required." }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,release_version,stage")
      .eq("id", releaseId)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return controlTowerJson({ error: "Release does not exist." }, 404);
    if (["production", "observed", "closed"].includes(release.stage)) {
      return controlTowerJson({ error: `Standard gates cannot be initialized after ${release.stage}.`, code: "RELEASE_GATE_FROZEN" }, 409);
    }

    const payload = CONTROL_TOWER_STANDARD_GATES.map((gate) => ({
      release_id: releaseId,
      gate_key: gate.gate_key,
      label: gate.label,
      required: gate.required,
      state: "pending",
      detail: "Awaiting verified evidence.",
      evidence: { phase: gate.phase, initialized_by: "control_tower" },
    }));

    const { data, error } = await auth.supabase
      .from("control_tower_release_gates")
      .upsert(payload, { onConflict: "release_id,gate_key", ignoreDuplicates: true })
      .select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at");

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23503") return controlTowerJson({ error: "Release does not exist." }, 409);
      throw error;
    }

    await appendControlTowerAudit(auth.supabase, {
      action: "standard_release_gates_initialized",
      entityType: "release",
      entityId: releaseId,
      metadata: {
        actor_role: auth.role,
        gate_count: CONTROL_TOWER_STANDARD_GATES.length,
        release_version: release.release_version,
        release_stage: release.stage,
      },
    });

    return controlTowerJson({ initialized: true, gates: data || [] }, 201);
  } catch {
    return controlTowerJson({ error: "Unable to initialize standard release gates." }, 500);
  }
}
