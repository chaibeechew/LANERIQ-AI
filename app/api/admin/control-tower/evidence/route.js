import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { validateControlTowerEvidenceInput } from "../../../../../lib/control-tower-evidence.js";
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
    if (!releaseId) return json({ error: "releaseId is required." }, 400);

    const { data, error } = await auth.supabase
      .from("control_tower_items")
      .select("id,release_id,title,description,stage,priority,external_ref,metadata,created_at,updated_at")
      .eq("release_id", releaseId)
      .eq("item_type", "evidence")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, evidence: [] });
      throw error;
    }
    return json({ storageReady: true, evidence: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower evidence." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;
    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerEvidenceInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    const { data: release, error: releaseError } = await auth.supabase
      .from("control_tower_releases")
      .select("id,release_version,stage")
      .eq("id", validation.value.release_id)
      .maybeSingle();
    if (releaseError) {
      if (isControlTowerStorageMissing(releaseError)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      throw releaseError;
    }
    if (!release) return json({ error: "Release does not exist." }, 404);

    const { data, error } = await auth.supabase
      .from("control_tower_items")
      .insert(validation.value)
      .select("id,release_id,title,description,stage,priority,external_ref,metadata,created_at,updated_at")
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23505") return json({ error: "This exact evidence snapshot is already registered.", code: "DUPLICATE_EVIDENCE" }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "evidence_registered",
      entity_type: "evidence",
      entity_id: data.id,
      after_state: {
        id: data.id,
        release_id: data.release_id,
        title: data.title,
        external_ref: data.external_ref,
        fingerprint: data.metadata?.fingerprint || null,
        kind: data.metadata?.kind || null,
      },
      metadata: { release_stage: release.stage, release_version: release.release_version },
    });

    return json({ evidence: data }, 201);
  } catch {
    return json({ error: "Unable to register Control Tower evidence." }, 500);
  }
}
