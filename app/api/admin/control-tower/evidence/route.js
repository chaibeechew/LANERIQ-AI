import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { validateControlTowerEvidenceInput } from "../../../../../lib/control-tower-evidence.js";
import { getControlTowerPrivilegedClient } from "../../../../../lib/control-tower-privileged.js";
import { isControlTowerStorageMissing, isControlTowerUuid } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVIDENCE_SELECT = "id,release_id,title,description,stage,priority,external_ref,metadata,created_at,updated_at";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;

    const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim().toLowerCase() || "";
    if (!isControlTowerUuid(releaseId)) return controlTowerJson({ error: "A valid releaseId is required." }, 400);

    const { data, error } = await auth.supabase
      .from("control_tower_items")
      .select(EVIDENCE_SELECT)
      .eq("release_id", releaseId)
      .eq("item_type", "evidence")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ storageReady: false, evidence: [] });
      throw error;
    }
    return controlTowerJson({ storageReady: true, evidence: data || [], capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower evidence." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;
    if (!auth.capabilities.registerEvidence) {
      return controlTowerJson({ error: "Evidence registration is not permitted for this role." }, 403);
    }

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerEvidenceInput(input);
    if (!validation.ok) return controlTowerJson({ error: validation.error }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,release_version,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) return controlTowerJson({ error: "Control Tower storage migration is not active in this environment." }, 503);
      throw releaseError;
    }
    if (!release) return controlTowerJson({ error: "Release does not exist." }, 404);
    if (release.stage === "closed") {
      return controlTowerJson({ error: "Closed releases cannot accept new evidence.", code: "RELEASE_CLOSED" }, 409);
    }

    const fingerprint = validation.value.metadata?.fingerprint || null;
    if (fingerprint) {
      const { data: duplicate, error: duplicateError } = await auth.supabase
        .from("control_tower_items")
        .select("id,created_at")
        .eq("release_id", validation.value.release_id)
        .eq("item_type", "evidence")
        .eq("metadata->>fingerprint", fingerprint)
        .maybeSingle();
      if (duplicateError && !isControlTowerStorageMissing(duplicateError)) throw duplicateError;
      if (duplicate) {
        return controlTowerJson({
          error: "This exact evidence snapshot is already registered.",
          code: "DUPLICATE_EVIDENCE",
          existingEvidenceId: duplicate.id,
        }, 409);
      }
    }

    let privileged;
    try {
      privileged = getControlTowerPrivilegedClient();
    } catch (error) {
      if (error?.code === "CONTROL_TOWER_PRIVILEGED_RUNTIME_MISSING") {
        return controlTowerJson({ error: "Privileged Control Tower runtime is not configured for atomic evidence writes.", code: error.code }, 503);
      }
      throw error;
    }

    const { data, error } = await privileged.rpc("register_control_tower_evidence_server", {
      p_release_id: validation.value.release_id,
      p_title: validation.value.title,
      p_description: validation.value.description,
      p_external_ref: validation.value.external_ref,
      p_metadata: validation.value.metadata,
      p_actor_user_id: auth.user.id,
      p_actor_role: auth.role,
    });

    if (error) {
      if (isControlTowerStorageMissing(error) || error.code === "42883") {
        return controlTowerJson({ error: "Atomic evidence migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") return controlTowerJson({ error: "This exact evidence snapshot is already registered.", code: "DUPLICATE_EVIDENCE" }, 409);
      if (error.code === "42501") return controlTowerJson({ error: "Server evidence authority denied." }, 503);
      if (["23503", "23514", "55000"].includes(error.code)) return controlTowerJson({ error: error.message || "Evidence contract rejected." }, 409);
      throw error;
    }

    return controlTowerJson({ evidence: data }, 201);
  } catch {
    return controlTowerJson({ error: "Unable to register Control Tower evidence." }, 500);
  }
}
