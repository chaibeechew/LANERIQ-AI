import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { isControlTowerReleaseFrozen } from "../../../../../lib/control-tower-state-machine.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerWorkstreamInput,
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

export async function GET(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_workstreams")
      .select("id,release_id,workstream_key,name,description,stage,dependencies,created_at,updated_at")
      .order("created_at", { ascending: true })
      .limit(200);

    if (releaseId) query = query.eq("release_id", releaseId);
    const { data, error } = await query;

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ storageReady: false, workstreams: [] });
      }
      throw error;
    }

    return json({ storageReady: true, workstreams: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower workstreams." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerWorkstreamInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      throw releaseError;
    }
    if (!release) return json({ error: "Release does not exist." }, 400);
    if (isControlTowerReleaseFrozen(release.stage)) {
      return json({ error: `Release is frozen at ${release.stage}. Move it back through the governed state machine before adding workstreams.`, code: "RELEASE_FROZEN" }, 409);
    }

    const { data, error } = await auth.supabase
      .from("control_tower_workstreams")
      .insert(validation.value)
      .select("id,release_id,workstream_key,name,description,stage,dependencies,created_at,updated_at")
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") return json({ error: "Workstream key already exists for this release." }, 409);
      if (error.code === "23503") return json({ error: "Release does not exist." }, 400);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "workstream_created",
      entity_type: "workstream",
      entity_id: data.id,
      after_state: data,
    });

    return json({ workstream: data }, 201);
  } catch {
    return json({ error: "Unable to create Control Tower workstream." }, 500);
  }
}
