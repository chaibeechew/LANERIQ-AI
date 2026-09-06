import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerReleaseInput,
  validateControlTowerReleasePatchInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const RELEASE_SELECT = "id,product_version,release_version,capability_layer,release_status,stage,target_platforms,release_notes,target_date,production_verified_at,production_verified_by,production_truth,created_at,updated_at";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.supabase
      .from("control_tower_releases")
      .select(RELEASE_SELECT)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, releases: [] });
      throw error;
    }

    return controlTowerJson({ storageReady: true, releases: data || [], capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower releases." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerReleaseInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data, error } = await auth.supabase
      .from("control_tower_releases")
      .insert(validation.value)
      .select(RELEASE_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") {
        return controlTowerJson({ error: validation.value.release_status === "active" ? "Only one Current Release may be active at a time." : "Release version already exists." }, 409);
      }
      throw error;
    }

    await appendControlTowerAudit(auth.supabase, {
      action: "release_created",
      entityType: "release",
      entityId: data.id,
      afterState: data,
      metadata: { actor_role: auth.role },
    });

    return controlTowerJson({ release: data }, 201);
  } catch {
    return controlTowerJson({ error: "Unable to create Control Tower release." }, 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerReleasePatchInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_releases")
      .select(RELEASE_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) {
        return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      throw beforeError;
    }
    if (!before) return controlTowerJson({ error: "Release not found." }, 404);
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return controlTowerJson({ error: "Release changed since it was loaded. Refresh before saving.", code: "STALE_RELEASE" }, 409);
    }

    let query = auth.supabase.from("control_tower_releases").update(validation.patch).eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(RELEASE_SELECT).maybeSingle();

    if (error) {
      if (error.code === "23505") return controlTowerJson({ error: "Only one Current Release may be active at a time." }, 409);
      throw error;
    }
    if (!data) return controlTowerJson({ error: "Release changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await appendControlTowerAudit(auth.supabase, {
      action: "release_updated",
      entityType: "release",
      entityId: data.id,
      beforeState: before,
      afterState: data,
      metadata: { actor_role: auth.role },
    });

    return controlTowerJson({ release: data });
  } catch {
    return controlTowerJson({ error: "Unable to update Control Tower release." }, 500);
  }
}
