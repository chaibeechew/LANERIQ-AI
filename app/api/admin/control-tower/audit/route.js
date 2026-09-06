import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;
    if (!auth.capabilities.readAudit) {
      return controlTowerJson({ error: "Audit access is not permitted for this role." }, 403);
    }

    const params = request.nextUrl.searchParams;
    const requestedLimit = Number.parseInt(params.get("limit") || "100", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 100;
    const entityType = params.get("entityType")?.trim();
    const entityId = params.get("entityId")?.trim();
    const before = params.get("before")?.trim();

    let query = auth.supabase
      .from("control_tower_audit_log")
      .select("id,actor_user_id,action,entity_type,entity_id,before_state,after_state,metadata,prev_hash,event_hash,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);
    if (before) {
      if (Number.isNaN(Date.parse(before))) return controlTowerJson({ error: "Invalid before timestamp." }, 400);
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, events: [] });
      throw error;
    }

    const events = data || [];
    return controlTowerJson({
      storageReady: true,
      events,
      nextBefore: events.length === limit ? events.at(-1)?.created_at || null : null,
      chainHead: events[0]?.event_hash || null,
    });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower audit events." }, 500);
  }
}
