import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerItemInput,
} from "../../../../../lib/control-tower-validation.js";

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

async function requireControlTowerAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: json({ error: "Authentication required." }, 401) };
  if (!canAccessControlTower(user.app_metadata?.role)) {
    return { error: json({ error: "Control Tower access required." }, 403) };
  }
  return { supabase, user };
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const releaseId = new URL(request.url).searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_items")
      .select("id,release_id,workstream_id,item_type,title,description,stage,priority,external_ref,metadata,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (releaseId) query = query.eq("release_id", releaseId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, items: [] });
      throw error;
    }
    return json({ storageReady: true, items: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower items." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerItemInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data, error } = await auth.supabase
      .from("control_tower_items")
      .insert(validation.value)
      .select("id,release_id,workstream_id,item_type,title,description,stage,priority,external_ref,metadata,created_at,updated_at")
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23503") return json({ error: "Referenced release or workstream does not exist." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "item_created",
      entity_type: data.item_type,
      entity_id: data.id,
      after_state: data,
    });

    return json({ item: data }, 201);
  } catch {
    return json({ error: "Unable to create Control Tower item." }, 500);
  }
}
