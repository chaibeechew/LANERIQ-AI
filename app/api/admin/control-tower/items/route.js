import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import {
  canTransitionControlTowerStage,
  isControlTowerReleaseFrozen,
} from "../../../../../lib/control-tower-state-machine.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerItemInput,
  validateControlTowerItemPatchInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const ITEM_SELECT = "id,release_id,workstream_id,item_type,title,description,stage,priority,external_ref,metadata,created_at,updated_at";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;
    const releaseId = new URL(request.url).searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_items")
      .select(ITEM_SELECT)
      .order("created_at", { ascending: false })
      .limit(300);
    if (releaseId) query = query.eq("release_id", releaseId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, items: [] });
      throw error;
    }
    return controlTowerJson({ storageReady: true, items: data || [] });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower items." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerItemInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return controlTowerJson({ error: "Release does not exist." }, 409);

    const frozen = isControlTowerReleaseFrozen(release.stage);
    const allowedWhileFrozen = ["evidence", "decision"].includes(validation.value.item_type);
    if (frozen && !allowedWhileFrozen) {
      return controlTowerJson({
        error: `Release is frozen at ${release.stage}. Only evidence or decision records may be appended without rolling the release back.`,
        code: "RELEASE_FROZEN",
      }, 409);
    }

    const { data, error } = await auth.supabase
      .from("control_tower_items")
      .insert(validation.value)
      .select(ITEM_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23503") return controlTowerJson({ error: "Referenced release or workstream does not exist." }, 409);
      throw error;
    }

    await appendControlTowerAudit(auth.supabase, {
      action: "item_created",
      entityType: data.item_type,
      entityId: data.id,
      afterState: data,
      metadata: { release_stage: release.stage, release_frozen: frozen, actor_role: auth.role },
    });
    return controlTowerJson({ item: data }, 201);
  } catch {
    return controlTowerJson({ error: "Unable to create Control Tower item." }, 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerItemPatchInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_items")
      .select(ITEM_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw beforeError;
    }
    if (!before) return controlTowerJson({ error: "Item not found." }, 404);
    if (before.item_type === "evidence") {
      return controlTowerJson({ error: "Evidence records are immutable. Register a new evidence snapshot instead.", code: "IMMUTABLE_EVIDENCE" }, 409);
    }
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return controlTowerJson({ error: "Item changed since it was loaded. Refresh before saving.", code: "STALE_ITEM" }, 409);
    }

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", before.release_id)
      .maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) return controlTowerJson({ error: "Parent release not found." }, 409);
    if (isControlTowerReleaseFrozen(release.stage) && before.item_type !== "decision") {
      return controlTowerJson({ error: `Release is frozen at ${release.stage}.`, code: "RELEASE_FROZEN" }, 409);
    }

    if (validation.patch.stage && !canTransitionControlTowerStage(before.stage, validation.patch.stage)) {
      return controlTowerJson({ error: `Invalid item transition ${before.stage} → ${validation.patch.stage}.`, code: "INVALID_STAGE_TRANSITION" }, 409);
    }

    let query = auth.supabase.from("control_tower_items").update(validation.patch).eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(ITEM_SELECT).maybeSingle();
    if (error) throw error;
    if (!data) return controlTowerJson({ error: "Item changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await appendControlTowerAudit(auth.supabase, {
      action: "item_updated",
      entityType: data.item_type,
      entityId: data.id,
      beforeState: before,
      afterState: data,
      metadata: { release_stage: release.stage, actor_role: auth.role },
    });
    return controlTowerJson({ item: data });
  } catch {
    return controlTowerJson({ error: "Unable to update Control Tower item." }, 500);
  }
}
