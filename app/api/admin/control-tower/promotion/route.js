import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { computeReleaseScorecard } from "../../../../../lib/control-tower-governance.js";
import { evaluatePromotionPolicy, normalizeControlTowerStage } from "../../../../../lib/control-tower-state-machine.js";
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

async function loadBundle(supabase, releaseId) {
  const [releaseResult, workstreamsResult, itemsResult, gatesResult] = await Promise.all([
    supabase.from("control_tower_releases").select("id,product_version,release_version,release_status,stage,target_platforms,target_date,updated_at").eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_workstreams").select("id,release_id,workstream_key,name,stage,dependencies,updated_at").eq("release_id", releaseId),
    supabase.from("control_tower_items").select("id,release_id,workstream_id,item_type,title,stage,priority,external_ref,metadata,updated_at").eq("release_id", releaseId),
    supabase.from("control_tower_release_gates").select("id,release_id,gate_key,label,state,required,detail,evidence,checked_at,updated_at").eq("release_id", releaseId),
  ]);
  for (const result of [releaseResult, workstreamsResult, itemsResult, gatesResult]) {
    if (result.error) throw result.error;
  }
  return {
    release: releaseResult.data,
    workstreams: workstreamsResult.data || [],
    items: itemsResult.data || [],
    gates: gatesResult.data || [],
  };
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const releaseId = typeof input.releaseId === "string" ? input.releaseId.trim() : "";
    const targetStage = normalizeControlTowerStage(input.targetStage);
    const expectedUpdatedAt = typeof input.expectedUpdatedAt === "string" ? input.expectedUpdatedAt.trim() : "";
    if (!releaseId) return json({ error: "releaseId is required." }, 400);
    if (!targetStage) return json({ error: "A valid targetStage is required." }, 400);

    let bundle;
    try {
      bundle = await loadBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) {
        return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      }
      throw error;
    }
    if (!bundle.release) return json({ error: "Release not found." }, 404);
    if (expectedUpdatedAt && bundle.release.updated_at !== expectedUpdatedAt) {
      return json({ error: "Release changed since it was loaded. Refresh before promoting.", code: "STALE_RELEASE" }, 409);
    }

    const liveStatus = await getControlTowerLiveStatus();
    const scorecard = computeReleaseScorecard({ ...bundle, liveStatus });
    const policy = evaluatePromotionPolicy({
      currentStage: bundle.release.stage,
      targetStage,
      scorecard,
    });
    if (!policy.allowed) {
      return json({ error: policy.reason, scorecard, policy }, 409);
    }

    let update = auth.supabase
      .from("control_tower_releases")
      .update({ stage: targetStage })
      .eq("id", releaseId);
    if (expectedUpdatedAt) update = update.eq("updated_at", expectedUpdatedAt);
    const { data, error } = await update
      .select("id,product_version,release_version,release_status,stage,target_platforms,target_date,created_at,updated_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ error: "Release changed during promotion. Refresh and retry.", code: "PROMOTION_RACE" }, 409);

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: "release_stage_promoted",
      entity_type: "release",
      entity_id: data.id,
      before_state: bundle.release,
      after_state: data,
      metadata: { scorecard_overall: scorecard.overall, target_stage: targetStage },
    });

    return json({ release: data, scorecard, policy }, 200);
  } catch {
    return json({ error: "Unable to promote Control Tower release." }, 500);
  }
}
