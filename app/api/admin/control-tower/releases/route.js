import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerReleaseInput,
  validateControlTowerReleasePatchInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const RELEASE_SELECT = "id,product_version,release_version,capability_layer,release_status,stage,target_platforms,release_notes,target_date,created_at,updated_at";

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
      .select(RELEASE_SELECT)
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
      .select(RELEASE_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") {
        return json({ error: validation.value.release_status === "active" ? "Only one Current Release may be active at a time." : "Release version already exists." }, 409);
      }
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

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerReleasePatchInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_releases")
      .select(RELEASE_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      throw beforeError;
    }
    if (!before) return json({ error: "Release not found." }, 404);
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return json({ error: "Release changed since it was loaded. Refresh before saving.", code: "STALE_RELEASE" }, 409);
    }

    let query = auth.supabase
      .from("control_tower_releases")
      .update(validation.patch)
      .eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(RELEASE_SELECT).maybeSingle();

    if (error) {
      if (error.code === "23505") return json({ error: "Only one Current Release may be active at a time." }, 409);
      throw error;
    }
    if (!data) return json({ error: "Release changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "release_updated",
      entity_type: "release",
      entity_id: data.id,
      before_state: before,
      after_state: data,
    });

    return json({ release: data });
  } catch {
    return json({ error: "Unable to update Control Tower release." }, 500);
  }
}
