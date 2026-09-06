import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { appendControlTowerAudit } from "../../../../../lib/control-tower-audit.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";
import { computeReleaseScorecard } from "../../../../../lib/control-tower-governance.js";
import { buildControlTowerReleaseSnapshot } from "../../../../../lib/control-tower-snapshot.js";
import { computeControlTowerTechnicalCeiling } from "../../../../../lib/control-tower-technical-ceiling.js";
import { evaluatePromotionPolicy, normalizeControlTowerStage } from "../../../../../lib/control-tower-state-machine.js";
import { isControlTowerStorageMissing } from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELEASE_SELECT = "id,product_version,release_version,capability_layer,release_status,stage,target_platforms,target_date,production_verified_at,production_verified_by,production_truth,created_at,updated_at";

async function loadBundle(supabase, releaseId) {
  const [releaseResult, workstreamsResult, itemsResult, gatesResult] = await Promise.all([
    supabase.from("control_tower_releases").select(RELEASE_SELECT).eq("id", releaseId).maybeSingle(),
    supabase.from("control_tower_workstreams").select("id,release_id,workstream_key,name,stage,dependencies,updated_at").eq("release_id", releaseId),
    supabase.from("control_tower_items").select("id,release_id,workstream_id,item_type,title,stage,priority,external_ref,metadata,created_at,updated_at").eq("release_id", releaseId),
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

function productionTruthSnapshot(liveStatus, releaseSnapshot, verifiedAt, technicalCeiling = null) {
  return {
    schema: "laneriq.control-tower.production-truth.v2",
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
    technical_ceiling_overall: technicalCeiling?.overall ?? null,
    technical_ceiling_digest: technicalCeiling?.dimensions?.operational?.attestation?.digest || null,
  };
}

function technicalCeilingSummary(technicalCeiling, sealedAt) {
  return {
    overall: technicalCeiling.overall,
    blockerCount: technicalCeiling.blockers.length,
    operational: technicalCeiling.dimensions.operational.overall,
    disasterRecovery: technicalCeiling.dimensions.disasterRecovery.score,
    supplyChain: technicalCeiling.dimensions.supplyChain.score,
    observability: technicalCeiling.dimensions.observability.score,
    capacity: technicalCeiling.dimensions.capacity.score,
    governance: technicalCeiling.dimensions.governance.score,
    sealedAt,
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

    let technicalCeiling = null;
    if (targetStage === "production") {
      technicalCeiling = computeControlTowerTechnicalCeiling({
        ...bundle,
        release: projectedRelease,
        liveStatus,
        now: verifiedAt,
      });
      if (!technicalCeiling.technicalCeilingEligible) {
        return controlTowerJson({
          error: "Production promotion requires Technical Ceiling 100 with zero blockers.",
          code: "TECHNICAL_CEILING_NOT_MET",
          scorecard,
          technicalCeiling,
        }, 409);
      }
    }

    const releaseSnapshot = buildControlTowerReleaseSnapshot({
      ...bundle,
      release: projectedRelease,
      scorecard,
      liveStatus,
    });

    let data;
    if (targetStage === "production") {
      const attestation = technicalCeiling.dimensions.operational.attestation;
      const ceilingSummary = technicalCeilingSummary(technicalCeiling, verifiedAt);
      const productionTruth = productionTruthSnapshot(liveStatus, releaseSnapshot, verifiedAt, technicalCeiling);
      const result = await auth.supabase.rpc("promote_control_tower_production_with_attestation", {
        p_release_id: releaseId,
        p_expected_updated_at: expectedUpdatedAt || null,
        p_verified_at: verifiedAt,
        p_production_truth: productionTruth,
        p_digest: attestation.digest,
        p_manifest: attestation.manifest,
        p_technical_ceiling: ceilingSummary,
      });

      if (result.error) {
        if (isControlTowerStorageMissing(result.error) || result.error.code === "42883") {
          return controlTowerJson({ error: "Atomic Production attestation migration is not active in this environment." }, 503);
        }
        if (result.error.code === "42501") return controlTowerJson({ error: "Production promotion authority denied." }, 403);
        if (result.error.code === "40001") return controlTowerJson({ error: "Release changed during promotion. Refresh and retry.", code: "PROMOTION_RACE" }, 409);
        if (["23503", "23514"].includes(result.error.code)) return controlTowerJson({ error: result.error.message || "Production promotion contract rejected." }, 409);
        throw result.error;
      }
      data = result.data;
    } else {
      let update = auth.supabase.from("control_tower_releases").update({ stage: targetStage }).eq("id", releaseId);
      if (expectedUpdatedAt) update = update.eq("updated_at", expectedUpdatedAt);
      const result = await update.select(RELEASE_SELECT).maybeSingle();
      if (result.error) {
        if (isControlTowerStorageMissing(result.error)) return controlTowerJson({ error: "Control Tower release storage is not active in this environment." }, 503);
        throw result.error;
      }
      if (!result.data) return controlTowerJson({ error: "Release changed during promotion. Refresh and retry.", code: "PROMOTION_RACE" }, 409);
      data = result.data;

      await appendControlTowerAudit(auth.supabase, {
        action: "release_stage_promoted",
        entityType: "release",
        entityId: data.id,
        beforeState: bundle.release,
        afterState: data,
        metadata: {
          scorecard_overall: scorecard.overall,
          target_stage: targetStage,
          actor_role: auth.role,
          production_eligible: scorecard.productionEligible,
          production_truth_recorded: false,
          release_snapshot_hash: releaseSnapshot.snapshotHash,
        },
      });
    }

    return controlTowerJson({
      release: data,
      scorecard,
      policy,
      technicalCeiling,
      snapshotHash: releaseSnapshot.snapshotHash,
      attestationDigest: technicalCeiling?.dimensions?.operational?.attestation?.digest || null,
    });
  } catch {
    return controlTowerJson({ error: "Unable to promote Control Tower release." }, 500);
  }
}
