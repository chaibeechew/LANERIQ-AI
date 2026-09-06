import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
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
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_workstreams")
      .select(WORKSTREAM_SELECT)
      .order("created_at", { ascending: true })
      .limit(200);
    if (releaseId) query = query.eq("release_id", releaseId);
    const { data, error } = await query;

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, workstreams: [] });
      throw error;
    }
    return controlTowerJson({ storageReady: true, workstreams: data || [] });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower workstreams." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerWorkstreamInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return controlTowerJson({ error: "Release does not exist." }, 400);
    if (isControlTowerReleaseFrozen(release.stage)) {
      return controlTowerJson({ error: `Release is frozen at ${release.stage}. Move it back through the governed state machine before adding workstreams.`, code: "RELEASE_FROZEN" }, 409);
    }

    const dependencyError = await validateDependencies(auth.supabase, validation.value.release_id, validation.value.workstream_key, validation.value.dependencies);
    if (dependencyError) return controlTowerJson({ error: dependencyError, code: "INVALID_DEPENDENCY" }, 409);

    const { data, error } = await auth.supabase
      .from("control_tower_workstreams")
      .insert(validation.value)
      .select(WORKSTREAM_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23505") return controlTowerJson({ error: "Workstream key already exists for this release." }, 409);
      if (error.code === "23503") return controlTowerJson({ error: "Release does not exist." }, 400);
      throw error;
    }

    await appendControlTowerAudit(auth.supabase, {
      action: "workstream_created",
      entityType: "workstream",
      entityId: data.id,
      afterState: data,
      metadata: { actor_role: auth.role },
    });
    return controlTowerJson({ workstream: data }, 201);
  } catch {
    return controlTowerJson({ error: "Unable to create Control Tower workstream." }, 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerWorkstreamPatchInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_workstreams")
      .select(WORKSTREAM_SELECT)
      .eq("id", validation.id)
      .maybeSingle();
    if (beforeError) {
      if (isControlTowerStorageMissing(beforeError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw beforeError;
    }
    if (!before) return controlTowerJson({ error: "Workstream not found." }, 404);
    if (validation.expectedUpdatedAt && before.updated_at !== validation.expectedUpdatedAt) {
      return controlTowerJson({ error: "Workstream changed since it was loaded. Refresh before saving.", code: "STALE_WORKSTREAM" }, 409);
    }

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,stage")
      .eq("id", before.release_id)
      .maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) return controlTowerJson({ error: "Parent release not found." }, 409);
    if (isControlTowerReleaseFrozen(release.stage)) return controlTowerJson({ error: `Release is frozen at ${release.stage}.`, code: "RELEASE_FROZEN" }, 409);

    if (validation.patch.stage && !canTransitionControlTowerStage(before.stage, validation.patch.stage)) {
      return controlTowerJson({ error: `Invalid workstream transition ${before.stage} → ${validation.patch.stage}.`, code: "INVALID_STAGE_TRANSITION" }, 409);
    }
    if (validation.patch.dependencies) {
      const dependencyError = await validateDependencies(auth.supabase, before.release_id, before.workstream_key, validation.patch.dependencies);
      if (dependencyError) return controlTowerJson({ error: dependencyError, code: "INVALID_DEPENDENCY" }, 409);
    }

    let query = auth.supabase.from("control_tower_workstreams").update(validation.patch).eq("id", validation.id);
    if (validation.expectedUpdatedAt) query = query.eq("updated_at", validation.expectedUpdatedAt);
    const { data, error } = await query.select(WORKSTREAM_SELECT).maybeSingle();
    if (error) throw error;
    if (!data) return controlTowerJson({ error: "Workstream changed while saving. Refresh and retry.", code: "UPDATE_RACE" }, 409);

    await appendControlTowerAudit(auth.supabase, {
      action: "workstream_updated",
      entityType: "workstream",
      entityId: data.id,
      beforeState: before,
      afterState: data,
      metadata: { actor_role: auth.role },
    });
    return controlTowerJson({ workstream: data });
  } catch {
    return controlTowerJson({ error: "Unable to update Control Tower workstream." }, 500);
  }
}
