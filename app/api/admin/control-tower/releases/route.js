import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerReleaseInput,
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: json({ error: "Authentication required." }, 401) };
  if (!canAccessControlTower(user.app_metadata?.role)) {
    return { error: json({ error: "Control Tower access required." }, 403) };
  }
  return { supabase, user };
}

export async function GET() {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const { data, error } = await auth.supabase
      .from("control_tower_releases")
      .select("id,product_version,release_version,capability_layer,release_status,stage,target_platforms,target_date,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ storageReady: false, releases: [] });
      }
      throw error;
    }

    return json({ storageReady: true, releases: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower releases." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerReleaseInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data, error } = await auth.supabase
      .from("control_tower_releases")
      .insert(validation.value)
      .select("id,product_version,release_version,capability_layer,release_status,stage,target_platforms,target_date,created_at,updated_at")
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") return json({ error: "Release version already exists." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "release_created",
      entity_type: "release",
      entity_id: data.id,
      after_state: data,
    });

    return json({ release: data }, 201);
  } catch {
    return json({ error: "Unable to create Control Tower release." }, 500);
  }
}
