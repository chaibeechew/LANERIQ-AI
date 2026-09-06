import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  LANERIQ_SESSION_COOKIE,
  LANERIQ_SESSION_MODE_COOKIE,
  isLaneriqPrimarySessionMode,
  validateLaneriqSessionToken,
} from "../../../../lib/auth/laneriq-session.js";
import { getOwnedProductionEvidenceProject } from "../../../../lib/cloud/production-evidence.js";
import { appendProductionEvidenceLedgerRecord } from "../../../../lib/cloud/production-evidence-ledger.js";

export const dynamic = "force-dynamic";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const MAX_REPORT_BYTES = 200_000;
const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;

function buildIdentity() {
  const commitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const commitRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
  const environment = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  return {
    commitSha,
    commitRef,
    environment,
    exactProductionBuildVerified: environment === "production" && commitRef === "main" && COMMIT_SHA.test(commitSha),
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function publicState(project) {
  return Boolean(project && (
    project.publish_status === "published" || project.visibility === "listed" || project.visibility === "public" || project.published_version_id
  ));
}

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Vary": "Cookie",
  } });
}

async function currentLaneriqSession(request) {
  const mode = request.cookies.get(LANERIQ_SESSION_MODE_COOKIE)?.value;
  if (!isLaneriqPrimarySessionMode(mode)) return { ok: false, code: "SESSION_REQUIRED" };
  const token = String(request.cookies.get(LANERIQ_SESSION_COOKIE)?.value || "");
  try {
    const session = await validateLaneriqSessionToken(token);
    if (!session?.userId) return { ok: false, code: "SESSION_REQUIRED" };
    return { ok: true, session };
  } catch {
    return { ok: false, code: "SESSION_NOT_READY" };
  }
}

export async function POST(request) {
  try {
    const build = buildIdentity();
    if (!build.exactProductionBuildVerified) return json({ error: "Production evidence attestation is available only on exact Vercel Production main." }, 409);

    const authority = await currentLaneriqSession(request);
    if (!authority.ok) return json(
      { error: authority.code === "SESSION_NOT_READY" ? "LANERIQ Session Authority is unavailable." : "Authentication required.", sessionAuthority: "laneriq" },
      authority.code === "SESSION_NOT_READY" ? 503 : 401,
    );

    const body = await request.json().catch(() => null);
    const report = body?.report;
    if (!report || typeof report !== "object" || Array.isArray(report)) return json({ error: "A Production closure evidence report is required." }, 400);

    const canonicalReport = JSON.stringify(canonicalize(report));
    if (Buffer.byteLength(canonicalReport, "utf8") > MAX_REPORT_BYTES) return json({ error: "Evidence report is too large." }, 413);
    if (report.success !== true || report.reportVersion !== 2 || report.evidenceLevel !== "AUTHENTICATED_PRODUCTION_APP_BUILDER_FULL_CLOSURE_V2") {
      return json({ error: "Only a successful authenticated Production closure V2 report can receive a release attestation." }, 422);
    }

    const generatedAtMs = Date.parse(String(report.generatedAt || ""));
    const ageMs = Date.now() - generatedAtMs;
    if (!Number.isFinite(generatedAtMs) || ageMs < -120_000 || ageMs > MAX_REPORT_AGE_MS) return json({ error: "Evidence report is stale or has an invalid generatedAt timestamp." }, 422);
    if (report?.build?.commitSha !== build.commitSha || report?.build?.commitRef !== "main" || report?.build?.environment !== "production" || report?.build?.exactProductionBuildVerified !== true) {
      return json({ error: "Evidence build identity does not match the active Production main deployment." }, 409);
    }

    const projectId = String(report?.project?.id || "").trim();
    const currentVersionId = String(report?.project?.currentVersionId || "").trim();
    if (!projectId || !currentVersionId) return json({ error: "Evidence project/version identity is incomplete." }, 422);

    const requiredClaims = [
      report.writesExercised === true,
      report.modifyUserCreditsCharged === 0,
      report.authenticated18PageRoutesVerified === true,
      Number(report.authenticated18PageRouteCount) === 18,
      report.releaseReadyVerified === true,
      report.publishExactVersionPinned === true,
      report.unpublishCleanupVerified === true,
      report.anonymousPrivateAfterCleanupVerified === true,
      report?.project?.remainsPrivateAfterTest === true,
      report?.safety?.workflowDryRunOnly === true,
      report?.safety?.workflowExternalActionsTriggered === false,
      report?.safety?.automaticUnpublishFinally === true,
      report?.safety?.databasePhysicalMigrationClaimed === false,
      report?.safety?.physicalDeviceVerified === false,
      report?.safety?.officialStoreSubmissionVerified === false,
      report?.safety?.smsExercised === false,
    ];
    if (requiredClaims.some((claim) => !claim)) return json({ error: "Evidence report does not satisfy the Production release attestation claim set." }, 422);

    const projectResult = await getOwnedProductionEvidenceProject({ userId: authority.session.userId, projectId });
    if (!projectResult.ok && projectResult.code === "PROJECT_NOT_FOUND") return json({ error: "Evidence project was not found for this authenticated LANERIQ user." }, 404);
    if (!projectResult.ok) return json({ error: "Unable to verify the evidence project." }, 503);

    const project = projectResult.project;
    if (String(project?.current_version_id || "") !== currentVersionId) return json({ error: "Evidence current version no longer matches the owned Production project." }, 409);
    if (publicState(project)) return json({ error: "Evidence project is still public; release attestation is blocked until cleanup is proven." }, 409);

    const reportHash = sha256(canonicalReport);
    const userBindingHash = sha256(`laneriq-production-attestation-v1:${authority.session.userId}:${build.commitSha}`);
    const sessionBindingHash = sha256(`laneriq-production-session-v1:${authority.session.sessionId}:${build.commitSha}`);
    const attestedAt = new Date().toISOString();
    const attestationId = `laneriq-prod-${build.commitSha.slice(0, 12)}-${reportHash.slice(0, 20)}`;

    const ledger = await appendProductionEvidenceLedgerRecord({
      userId: authority.session.userId,
      projectId,
      versionId: currentVersionId,
      attestationId,
      productionSha: build.commitSha,
      reportHash,
      userBindingHash,
      sessionBindingHash,
    });
    if (!ledger.ok) return json({ error: "Production attestation passed but its internal evidence ledger receipt could not be persisted.", code: ledger.code }, 503);

    return json({
      ok: true,
      verdict: "PASS",
      attestationVersion: 2,
      attestationId,
      attestedAt,
      reportHashAlgorithm: "SHA-256",
      reportHash,
      userBindingHash,
      sessionBindingHash,
      build,
      reportAgeMs: ageMs,
      sessionAuthority: "laneriq",
      ledgerReceipt: {
        ledgerVersion: 1,
        id: ledger.receipt.id,
        sequence: ledger.receipt.sequence,
        previousHash: ledger.receipt.previousHash,
        entryHash: ledger.receipt.entryHash,
        createdAt: ledger.receipt.createdAt,
        appendOnly: true,
      },
      projectSnapshot: {
        id: project.id,
        currentVersionId: project.current_version_id,
        publishStatus: project.publish_status || null,
        visibility: project.visibility || null,
        publishedVersionId: project.published_version_id || null,
        privateAfterTestVerified: true,
      },
      claims: {
        authenticatedSessionVerified: true,
        laneriqPrimarySessionVerified: true,
        projectOwnershipVerified: true,
        exactProductionMainVerified: true,
        exactCurrentVersionVerified: true,
        authenticated18PageRoutesReported: 18,
        noUserCreditsReported: true,
        workflowDryRunOnlyReported: true,
        exactVersionPublishReported: true,
        unpublishCleanupReported: true,
        currentPrivateStateVerifiedByServer: true,
        internalPersistentLedgerRecorded: true,
      },
      truthBoundary: {
        tamperEvidentReportHash: true,
        internalPersistentLedgerRecorded: true,
        persistentAuditStorageClaimed: false,
        persistentExternalAuditStorageClaimed: false,
        cryptographicSignatureClaimed: false,
        independentThirdPartyAuditClaimed: false,
        physicalDeviceVerified: false,
        providerLiveVerified: false,
        physicalDatabaseMigrationVerified: false,
        officialStoreSubmissionVerified: false,
        emailDeliveryVerified: false,
        whatsappDeliveryVerified: false,
        smsDeliveryVerified: false,
      },
    });
  } catch (error) {
    console.error("PRODUCTION_EVIDENCE_ATTESTATION_ERROR:", error?.code || error?.name || "unknown");
    return json({ error: "Unable to attest Production evidence." }, 500);
  }
}
