import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Authentication required." }, 401);
    if (!canAccessControlTower(user.app_metadata?.role)) {
      return json({ error: "Control Tower access required." }, 403);
    }

    const params = new URL(request.url).searchParams;
    const requestedLimit = Number.parseInt(params.get("limit") || "100", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 100;
    const entityType = params.get("entityType")?.trim();
    const entityId = params.get("entityId")?.trim();

    let query = supabase
      .from("control_tower_audit_log")
      .select("id,actor_user_id,action,entity_type,entity_id,before_state,after_state,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, events: [] });
      throw error;
    }
    return json({ storageReady: true, events: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower audit events." }, 500);
  }
}
