import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import {
  canTransitionControlTowerStage,
  isControlTowerReleaseFrozen,
} from "../../../../../lib/control-tower-state-machine.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerWorkstreamInput,
  validateControlTowerWorkstreamPatchInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const WORKSTREAM_SELECT = "id,release_id,workstream_key,name,description,stage,dependencies,created_at,updated_at";

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

async function validateDependencies(supabase, releaseId, workstreamKey, dependencies) {
  if (!Array.isArray(dependencies)) return null;
  if (dependencies.includes(workstreamKey)) return "A workstream cannot depend on itself.";
  if (!dependencies.length) return null;
  const { data, error } = await supabase
    .from("control_tower_workstreams")
    .select("workstream_key")
    .eq("release_id", releaseId)
    .in("workstream_key", dependencies);
  if (error) throw error;
  const found = new Set((data || []).map((item) => item.workstream_key));
  const missing = dependencies.filter((key) => !found.has(key));
  return missing.length ? `Unknown workstream dependencies: ${missing.join(", ")}` : null;
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_workstreams")
      .select(WORKSTREAM_SELECT)
      .order("created_at", { ascending: true })
      .limit(200);
    if (releaseId) query = query.eq("release_id", releaseId);
    const { data, error } = await query;

    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, workstreams: [] });
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
      if (isControlTowerStorageMissing(releaseError)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return json({ error: "Release does not exist." }, 400);
    if (isControlTowerReleaseFrozen(release.stage)) {
      return json({ error: `Release is frozen at ${release.stage}. Move it back through the governed state machine before adding workstreams.`, code: "RELEASE_FROZEN" }, 409);
    }

    const dependencyError = await validateDependencies(
      auth.supabase,
      validation.value.release_id,
      validation.value.workstream_key,
      validation.value.dependencies,
    );
    if (dependencyError) return json({ error: dependencyError, code: "INVALID_DEPENDENCY" }, 409);

    const { data, error } = await auth.supabase
      .from("control_tower_workstreams")
      .insert(validation.value)
      .select(WORKSTREAM_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
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

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerWorkstreamPatchInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_workstreams")
      .select(WORKSTREAM_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw beforeError;
    }
    if (!before) return json({ error: "Workstream not found." }, 404);
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return json({ error: "Workstream changed since it was loaded. Refresh before saving.", code: "STALE_WORKSTREAM" }, 409);
    }

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", before.release_id)
      .maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) return json({ error: "Parent release not found." }, 409);
    if (isControlTowerReleaseFrozen(release.stage)) {
      return json({ error: `Release is frozen at ${release.stage}.`, code: "RELEASE_FROZEN" }, 409);
    }

    if (validation.patch.stage && !canTransitionControlTowerStage(before.stage, validation.patch.stage)) {
      return json({ error: `Invalid workstream transition ${before.stage} → ${validation.patch.stage}.`, code: "INVALID_STAGE_TRANSITION" }, 409);
    }
    if (validation.patch.dependencies) {
      const dependencyError = await validateDependencies(auth.supabase, before.release_id, before.workstream_key, validation.patch.dependencies);
      if (dependencyError) return json({ error: dependencyError, code: "INVALID_DEPENDENCY" }, 409);
    }

    let query = auth.supabase.from("control_tower_workstreams").update(validation.patch).eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(WORKSTREAM_SELECT).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Workstream changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "workstream_updated",
      entity_type: "workstream",
      entity_id: data.id,
      before_state: before,
      after_state: data,
    });
    return json({ workstream: data });
  } catch {
    return json({ error: "Unable to update Control Tower workstream." }, 500);
  }
}
