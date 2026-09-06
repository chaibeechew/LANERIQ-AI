import { NextResponse } from "next/server";
import {
  LANERIQ_SESSION_COOKIE,
  LANERIQ_SESSION_MODE_COOKIE,
  isLaneriqPrimarySessionMode,
  validateLaneriqSessionToken,
} from "../../../../lib/auth/laneriq-session.js";
import { getOwnedProductionEvidenceLedger } from "../../../../lib/cloud/production-evidence-ledger.js";

export const dynamic = "force-dynamic";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Vary": "Cookie",
    },
  });
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

export async function GET(request) {
  const build = buildIdentity();
  if (!build.exactProductionBuildVerified) {
    return json({ error: "Production evidence replay is available only on exact Vercel Production main." }, 409);
  }

  const authority = await currentLaneriqSession(request);
  if (!authority.ok) {
    return json(
      { error: authority.code === "SESSION_NOT_READY" ? "LANERIQ Session Authority is unavailable." : "Authentication required.", sessionAuthority: "laneriq" },
      authority.code === "SESSION_NOT_READY" ? 503 : 401,
    );
  }

  const projectId = String(request.nextUrl.searchParams.get("projectId") || "").trim();
  if (!UUID.test(projectId)) return json({ error: "A valid projectId is required." }, 400);

  const result = await getOwnedProductionEvidenceLedger({ userId: authority.session.userId, projectId });
  if (!result.ok && result.code === "PROJECT_NOT_FOUND") return json({ error: "Evidence project was not found for this authenticated LANERIQ user." }, 404);
  if (!result.ok) return json({ error: "Unable to replay Production evidence." }, 503);

  return json({
    ok: result.verification.ok,
    verdict: result.verification.verdict,
    build,
    sessionAuthority: "laneriq",
    projectId,
    chain: result.verification,
    entries: result.entries.map((entry) => ({
      sequence: entry.sequence,
      attestationId: entry.attestationId,
      productionSha: entry.productionSha,
      versionId: entry.versionId,
      reportHash: entry.reportHash,
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
      createdAt: entry.createdAt,
    })),
    truthBoundary: {
      internalPersistentLedgerVerified: result.verification.ok,
      tamperEvidentHashContinuityVerified: result.verification.ok,
      cryptographicSignatureClaimed: false,
      independentThirdPartyAuditClaimed: false,
      externalAuditStorageClaimed: false,
    },
  }, result.verification.ok ? 200 : 409);
}
