import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerGateInput,
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
      .from("control_tower_release_gates")
      .select("id,release_id,gate_key,label,state,required,detail,evidence,checked_by,checked_at,created_at,updated_at")
      .order("created_at", { ascending: true })
      .limit(200);
    if (releaseId) query = query.eq("release_id", releaseId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, gates: [] });
      throw error;
    }
    return json({ storageReady: true, gates: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower release gates." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerGateInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const payload = {
      ...validation.value,
      checked_by: validation.value.state === "pending" ? null : auth.user.id,
      checked_at: validation.value.state === "pending" ? null : new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("control_tower_release_gates")
      .upsert(payload, { onConflict: "release_id,gate_key" })
      .select("id,release_id,gate_key,label,state,required,detail,evidence,checked_by,checked_at,created_at,updated_at")
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23503") return json({ error: "Referenced release does not exist." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "release_gate_upserted",
      entity_type: "release_gate",
      entity_id: data.id,
      after_state: data,
    });

    return json({ gate: data }, 201);
  } catch {
    return json({ error: "Unable to save Control Tower release gate." }, 500);
  }
}
