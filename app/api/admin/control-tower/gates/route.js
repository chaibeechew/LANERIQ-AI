import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import {
  controlTowerGatePhase,
  isControlTowerGateWaivable,
} from "../../../../../lib/control-tower-governance.js";
import { sanitizeControlTowerEvidenceSnapshot } from "../../../../../lib/control-tower-evidence.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerGateInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const GATE_SELECT = "id,release_id,gate_key,label,state,required,detail,evidence,checked_by,checked_at,created_at,updated_at";
const IMMUTABLE_RELEASE_STAGES = new Set(["production", "observed", "closed"]);

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_release_gates")
      .select(GATE_SELECT)
      .order("created_at", { ascending: true })
      .limit(200);
    if (releaseId) query = query.eq("release_id", releaseId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, gates: [] });
      throw error;
    }
    return controlTowerJson({ storageReady: true, gates: data || [], capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower release gates." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerGateInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    if (controlTowerGatePhase(validation.value.gate_key) === "production") {
      return controlTowerJson({
        error: "Production identity gates are system-managed from live release truth and cannot be manually overridden.",
        code: "SYSTEM_MANAGED_GATE",
      }, 409);
    }

    if (validation.value.state === "waived") {
      if (!isControlTowerGateWaivable(validation.value.gate_key)) {
        return controlTowerJson({ error: "This release gate cannot be waived.", code: "NON_WAIVABLE_GATE" }, 409);
      }
      if (!auth.capabilities.waiveGate) {
        return controlTowerJson({ error: "Owner or Super Admin approval is required to waive a release gate.", code: "WAIVER_APPROVAL_REQUIRED" }, 403);
      }
    }

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage,release_version")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return controlTowerJson({ error: "Referenced release does not exist." }, 404);
    if (IMMUTABLE_RELEASE_STAGES.has(release.stage)) {
      return controlTowerJson({
        error: `Release gate history is immutable after ${release.stage}. Create a new release or governed rollback instead.`,
        code: "RELEASE_GATE_FROZEN",
      }, 409);
    }

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_release_gates")
      .select(GATE_SELECT)
      .eq("release_id", validation.value.release_id)
      .eq("gate_key", validation.value.gate_key)
      .maybeSingle();
    if (beforeError && !isControlTowerStorageMissing(beforeError)) throw beforeError;

    const payload = {
      ...validation.value,
      evidence: sanitizeControlTowerEvidenceSnapshot(validation.value.evidence),
      checked_by: validation.value.state === "pending" ? null : auth.user.id,
      checked_at: validation.value.state === "pending" ? null : new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("control_tower_release_gates")
      .upsert(payload, { onConflict: "release_id,gate_key" })
      .select(GATE_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23503") return controlTowerJson({ error: "Referenced release does not exist." }, 409);
      throw error;
    }

    await appendControlTowerAudit(auth.supabase, {
      action: before ? "release_gate_updated" : "release_gate_created",
      entityType: "release_gate",
      entityId: data.id,
      beforeState: before || null,
      afterState: data,
      metadata: {
        actor_role: auth.role,
        waiver: data.state === "waived",
        release_id: release.id,
        release_version: release.release_version,
      },
    });

    return controlTowerJson({ gate: data }, before ? 200 : 201);
  } catch {
    return controlTowerJson({ error: "Unable to save Control Tower release gate." }, 500);
  }
}
