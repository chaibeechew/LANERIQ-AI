import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { computeReleaseScorecard } from "../../../../../lib/control-tower-governance.js";
import { buildControlTowerReleaseSnapshot } from "../../../../../lib/control-tower-snapshot.js";
import { evaluatePromotionPolicy, normalizeControlTowerStage } from "../../../../../lib/control-tower-state-machine.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELEASE_SELECT = "id,product_version,release_version,capability_layer,release_status,stage,target_platforms,target_date,production_verified_at,production_verified_by,production_truth,created_at,updated_at";

async function loadBundle(supabase, releaseId) {
  const [releaseResult, workstreamsResult, itemsResult, gatesResult] = await Promise.all([
    supabase.from("control_tower_releases").select(RELEASE_SELECT).eq("id", releaseId).maybeSingle(),
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

function productionTruthSnapshot(liveStatus, releaseSnapshot, verifiedAt) {
  return {
    schema: "laneriq.control-tower.production-truth.v1",
    verified_at: verifiedAt,
    repository: liveStatus.repository,
    github_main_sha: liveStatus.github?.mainSha || null,
    github_ci_state: liveStatus.github?.ciState || "unknown",
    github_check_runs_total: liveStatus.github?.checkRunsTotal ?? null,
    github_check_runs_failed: liveStatus.github?.checkRunsFailed ?? null,
    github_check_runs_pending: liveStatus.github?.checkRunsPending ?? null,
    runtime_sha: liveStatus.runtime?.commitSha || null,
    runtime_environment: liveStatus.runtime?.environment || "unknown",
    runtime_branch: liveStatus.runtime?.branch || null,
    deployment_url: liveStatus.runtime?.deploymentUrl || null,
    production_url: liveStatus.runtime?.productionUrl || null,
    supabase_configured: Boolean(liveStatus.runtime?.supabaseConfigured),
    exact_sha: Boolean(liveStatus.releaseTruth?.exactSha),
    production_verified: Boolean(liveStatus.releaseTruth?.productionVerified),
    release_snapshot_hash: releaseSnapshot.snapshotHash,
    release_snapshot_algorithm: releaseSnapshot.hashAlgorithm,
  };
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerApi(request, { mutation: true });
    if (!auth.ok) return auth.response;

    const input = await request.json().catch(() => ({}));
    const releaseId = typeof input.releaseId === "string" ? input.releaseId.trim() : "";
    const targetStage = normalizeControlTowerStage(input.targetStage);
    const expectedUpdatedAt = typeof input.expectedUpdatedAt === "string" ? input.expectedUpdatedAt.trim() : "";
    if (!releaseId) return controlTowerJson({ error: "releaseId is required." }, 400);
    if (!targetStage) return controlTowerJson({ error: "A valid targetStage is required." }, 400);
    if (targetStage === "production" && !auth.capabilities.promoteProduction) {
      return controlTowerJson({ error: "Owner or Super Admin approval is required for Production promotion.", code: "PRODUCTION_APPROVAL_REQUIRED" }, 403);
    }
    if (targetStage === "release_candidate" && !auth.capabilities.promoteReleaseCandidate) {
      return controlTowerJson({ error: "Release Candidate promotion is not permitted for this role." }, 403);
    }

    let bundle;
    try {
      bundle = await loadBundle(auth.supabase, releaseId);
    } catch (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Control Tower storage migration is not fully active in this environment." }, 503);
      throw error;
    }
    if (!bundle.release) return controlTowerJson({ error: "Release not found." }, 404);
    if (targetStage === "production" && bundle.release.release_status !== "active") {
      return controlTowerJson({ error: "Only the Current Release may be promoted to Production.", code: "NOT_CURRENT_RELEASE" }, 409);
    }
    if (expectedUpdatedAt && bundle.release.updated_at !== expectedUpdatedAt) {
      return controlTowerJson({ error: "Release changed since it was loaded. Refresh before promoting.", code: "STALE_RELEASE" }, 409);
    }

    const liveStatus = await getControlTowerLiveStatus();
    const scorecard = computeReleaseScorecard({ ...bundle, liveStatus });
    const policy = evaluatePromotionPolicy({
      currentStage: bundle.release.stage,
      targetStage,
      scorecard,
    });
    if (!policy.allowed) return controlTowerJson({ error: policy.reason, scorecard, policy }, 409);

    const verifiedAt = new Date().toISOString();
    const projectedRelease = targetStage === "production"
      ? { ...bundle.release, stage: "production", production_verified_at: verifiedAt }
      : { ...bundle.release, stage: targetStage };
    const releaseSnapshot = buildControlTowerReleaseSnapshot({
      ...bundle,
      release: projectedRelease,
      scorecard,
      liveStatus,
    });

    const updatePayload = { stage: targetStage };
    if (targetStage === "production") {
      updatePayload.production_verified_at = verifiedAt;
      updatePayload.production_verified_by = auth.user.id;
      updatePayload.production_truth = productionTruthSnapshot(liveStatus, releaseSnapshot, verifiedAt);
    }

    let update = auth.supabase.from("control_tower_releases").update(updatePayload).eq("id", releaseId);
    if (expectedUpdatedAt) update = update.eq("updated_at", expectedUpdatedAt);
    const { data, error } = await update.select(RELEASE_SELECT).maybeSingle();

    if (error) {
      if (isControlTowerStorageMissing(error)) return controlTowerJson({ error: "Production truth storage is not active in this environment." }, 503);
      throw error;
    }
    if (!data) return controlTowerJson({ error: "Release changed during promotion. Refresh and retry.", code: "PROMOTION_RACE" }, 409);

    await appendControlTowerAudit(auth.supabase, {
      action: targetStage === "production" ? "release_promoted_to_production" : "release_stage_promoted",
      entityType: "release",
      entityId: data.id,
      beforeState: bundle.release,
      afterState: data,
      metadata: {
        scorecard_overall: scorecard.overall,
        target_stage: targetStage,
        actor_role: auth.role,
        production_eligible: scorecard.productionEligible,
        production_truth_recorded: targetStage === "production",
        release_snapshot_hash: releaseSnapshot.snapshotHash,
      },
    });

    return controlTowerJson({
      release: data,
      scorecard,
      policy,
      snapshotHash: releaseSnapshot.snapshotHash,
    });
  } catch {
    return controlTowerJson({ error: "Unable to promote Control Tower release." }, 500);
  }
}
