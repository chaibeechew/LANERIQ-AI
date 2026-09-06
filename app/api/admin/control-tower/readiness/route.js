import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import {
  CONTROL_TOWER_STANDARD_GATES,
  computeReleaseScorecard,
} from "../../../../../lib/control-tower-governance.js";
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

async function loadReleaseBundle(supabase, releaseId) {
  const [releaseResult, workstreamResult, itemResult, gateResult] = await Promise.all([
    supabase.from("control_tower_releases").select("id,product_version,release_version,release_status,stage,target_platforms,target_date,updated_at").eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_workstreams").select("id,release_id,workstream_key,name,stage,dependencies,updated_at").eq("release_id", releaseId).order("created_at", { ascending: true }),
    supabase.from("control_tower_items").select("id,release_id,workstream_id,item_type,title,stage,priority,external_ref,metadata,updated_at").eq("release_id", releaseId).order("created_at", { ascending: false }),
    supabase.from("control_tower_release_gates").select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at").eq("release_id", releaseId).order("created_at", { ascending: true }),
  ]);

  for (const result of [releaseResult, workstreamResult, itemResult, gateResult]) {
    if (result.error) throw result.error;
  }
  return {
    release: releaseResult.data,
    workstreams: workstreamResult.data || [],
    items: itemResult.data || [],
    gates: gateResult.data || [],
  };
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;
    const releaseId = new URL(request.url).searchParams.get("releaseId")?.trim();
    if (!releaseId) return json({ error: "releaseId is required." }, 400);

    let bundle;
    try {
      bundle = await loadReleaseBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ storageReady: false, scorecard: null });
      }
      throw error;
    }
    if (!bundle.release) return json({ error: "Release not found." }, 404);

    const liveStatus = await getControlTowerLiveStatus();
    const scorecard = computeReleaseScorecard({ ...bundle, liveStatus });
    return json({ storageReady: true, ...bundle, liveStatus, scorecard });
  } catch {
    return json({ error: "Unable to evaluate release readiness." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;
    const input = await request.json().catch(() => ({}));
    const releaseId = typeof input.releaseId === "string" ? input.releaseId.trim() : "";
    if (!releaseId) return json({ error: "releaseId is required." }, 400);

    const payload = CONTROL_TOWER_STANDARD_GATES.map((gate) => ({
      release_id: releaseId,
      ...gate,
      state: "pending",
      detail: "Awaiting verified evidence.",
      evidence: {},
    }));

    const { data, error } = await auth.supabase
      .from("control_tower_release_gates")
      .upsert(payload, { onConflict: "release_id,gate_key", ignoreDuplicates: true })
      .select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at");

    if (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      if (error.code === "23503") return json({ error: "Release does not exist." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "standard_release_gates_initialized",
      entity_type: "release",
      entity_id: releaseId,
      metadata: { gate_count: CONTROL_TOWER_STANDARD_GATES.length },
    });

    return json({ initialized: true, gates: data || [] }, 201);
  } catch {
    return json({ error: "Unable to initialize standard release gates." }, 500);
  }
}
