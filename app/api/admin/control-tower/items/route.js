import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
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
      .select(ITEM_SELECT)
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

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return json({ error: "Release does not exist." }, 409);

    const frozen = isControlTowerReleaseFrozen(release.stage);
    const allowedWhileFrozen = ["evidence", "decision"].includes(validation.value.item_type);
    if (frozen && !allowedWhileFrozen) {
      return json({
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
      if (isControlTowerStorageMissing(error)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23503") return json({ error: "Referenced release or workstream does not exist." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "item_created",
      entity_type: data.item_type,
      entity_id: data.id,
      after_state: data,
      metadata: { release_stage: release.stage, release_frozen: frozen },
    });
    return json({ item: data }, 201);
  } catch {
    return json({ error: "Unable to create Control Tower item." }, 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerItemPatchInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_items")
      .select(ITEM_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw beforeError;
    }
    if (!before) return json({ error: "Item not found." }, 404);
    if (before.item_type === "evidence") {
      return json({ error: "Evidence records are immutable. Register a new evidence snapshot instead.", code: "IMMUTABLE_EVIDENCE" }, 409);
    }
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return json({ error: "Item changed since it was loaded. Refresh before saving.", code: "STALE_ITEM" }, 409);
    }

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", before.release_id)
      .maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) return json({ error: "Parent release not found." }, 409);
    if (isControlTowerReleaseFrozen(release.stage) && before.item_type !== "decision") {
      return json({ error: `Release is frozen at ${release.stage}.`, code: "RELEASE_FROZEN" }, 409);
    }

    if (validation.patch.stage && !canTransitionControlTowerStage(before.stage, validation.patch.stage)) {
      return json({ error: `Invalid item transition ${before.stage} → ${validation.patch.stage}.`, code: "INVALID_STAGE_TRANSITION" }, 409);
    }

    let query = auth.supabase.from("control_tower_items").update(validation.patch).eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(ITEM_SELECT).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Item changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "item_updated",
      entity_type: data.item_type,
      entity_id: data.id,
      before_state: before,
      after_state: data,
      metadata: { release_stage: release.stage },
    });
    return json({ item: data });
  } catch {
    return json({ error: "Unable to update Control Tower item." }, 500);
  }
}
