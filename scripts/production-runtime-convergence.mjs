import crypto from "node:crypto";
import fs from "node:fs";

const SHA40 = /^[0-9a-f]{40}$/;
const DPL = /^dpl_[A-Za-z0-9]+$/;
const expectedSha = String(process.env.LANERIQ_EXPECTED_PRODUCTION_SHA || "").trim().toLowerCase();
const baseUrl = String(process.env.LANERIQ_PRODUCTION_URL || "").trim().replace(/\/$/, "");
const maxAttempts = Math.min(60, Math.max(1, Number(process.env.LANERIQ_RUNTIME_MAX_ATTEMPTS || 30)));
const retryMs = Math.min(30000, Math.max(1000, Number(process.env.LANERIQ_RUNTIME_RETRY_MS || 10000)));

if (!SHA40.test(expectedSha)) throw new Error("PRODUCTION_RUNTIME_EXPECTED_SHA_INVALID");
if (baseUrl !== "https://laneriq-ai.vercel.app") throw new Error("PRODUCTION_RUNTIME_CANONICAL_URL_INVALID");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getBuildInfo(attempt, phase) {
  const url = `${baseUrl}/api/build-info?laneriq_runtime=${expectedSha}&attempt=${attempt}&phase=${phase}&t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get("content-type") || "";
  const cacheControl = response.headers.get("cache-control") || "";
  const edgeRequestId = response.headers.get("x-vercel-id") || "";
  if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`BUILD_INFO_HTTP_INVALID:${response.status}:${contentType}`);
  }
  const body = await response.json();
  return { body, cacheControl, edgeRequestId };
}

async function getRootDeployment(attempt) {
  const url = `${baseUrl}/?laneriq_runtime=${expectedSha}&attempt=${attempt}&t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    headers: { Accept: "text/html", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get("content-type") || "";
  const edgeRequestId = response.headers.get("x-vercel-id") || "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
    throw new Error(`ROOT_HTTP_INVALID:${response.status}:${contentType}`);
  }
  const html = await response.text();
  const deploymentId = html.match(/<html[^>]*\sdata-dpl-id=["']([^"']+)["']/i)?.[1] || "";
  if (!DPL.test(deploymentId)) throw new Error("ROOT_DEPLOYMENT_ID_MISSING");
  return { deploymentId, edgeRequestId };
}

function exactProduction(info) {
  const body = info?.body || {};
  return body.ok === true &&
    body.product === "LANERIQ AI" &&
    String(body.commitSha || "").trim().toLowerCase() === expectedSha &&
    String(body.commitRef || "").trim() === "main" &&
    String(body.environment || "").trim().toLowerCase() === "production" &&
    String(info.cacheControl || "").toLowerCase().includes("no-store");
}

let lastObservation = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const before = await getBuildInfo(attempt, "before-root");
    if (!exactProduction(before)) {
      lastObservation = { attempt, phase: "before-root", body: before.body };
      console.log(`Runtime not converged yet (${attempt}/${maxAttempts}): ${JSON.stringify(lastObservation.body)}`);
    } else {
      const root = await getRootDeployment(attempt);
      const after = await getBuildInfo(attempt, "after-root");
      if (exactProduction(after)) {
        const manifest = {
          manifestVersion: 1,
          product: "LANERIQ AI",
          verdict: "PASS",
          evidenceLevel: "OBSERVED_PUBLIC_PRODUCTION_RUNTIME",
          expectedMainSha: expectedSha,
          runtimeCommitSha: String(after.body.commitSha).toLowerCase(),
          runtimeCommitRef: after.body.commitRef,
          runtimeEnvironment: String(after.body.environment).toLowerCase(),
          runtimeDeploymentId: root.deploymentId,
          runtimeEdgeRequestIds: [before.edgeRequestId, root.edgeRequestId, after.edgeRequestId].filter(Boolean),
          exactShaConvergenceVerified: true,
          doubleReadStabilityVerified: true,
          observedAt: new Date().toISOString(),
          truthBoundary: {
            publicProductionRuntimeObserved: true,
            deploymentMutationPerformed: false,
            rollbackPerformed: false,
            supabaseMutationPerformed: false,
            dnsMutationPerformed: false,
            providerLiveVerified: false,
            physicalDeviceVerified: false,
            independentThirdPartyAuditVerified: false,
            permanentImmutableAuditStorageClaimed: false,
            officialStoreSubmissionVerified: false,
            emailDeliveryVerified: false,
            whatsappDeliveryVerified: false,
            smsDeliveryVerified: false,
          },
        };
        const json = JSON.stringify(manifest, null, 2);
        const fileContents = `${json}\n`;
        const digest = crypto.createHash("sha256").update(fileContents).digest("hex");
        fs.writeFileSync("production-runtime-convergence-manifest.json", fileContents, "utf8");
        fs.writeFileSync(
          "production-runtime-convergence-manifest.sha256",
          `${digest}  production-runtime-convergence-manifest.json\n`,
          "utf8",
        );
        console.log(json);
        console.log(`PRODUCTION_RUNTIME_MANIFEST_SHA256=${digest}`);
        if (process.env.GITHUB_STEP_SUMMARY) {
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
            `# LANERIQ Production Runtime Convergence — PASS\n\n` +
            `- Expected/main SHA: \`${expectedSha}\`\n` +
            `- Runtime deployment: \`${root.deploymentId}\`\n` +
            `- Runtime ref/environment: \`main / production\`\n` +
            `- Double-read stability: **verified**\n` +
            `- Manifest file SHA-256: \`${digest}\`\n` +
            `- Evidence: **observed public Production runtime**\n`,
            "utf8",
          );
        }
        process.exit(0);
      }
      lastObservation = { attempt, phase: "after-root", body: after.body, deploymentId: root.deploymentId };
      console.log(`Alias changed during verification (${attempt}/${maxAttempts}); retrying.`);
    }
  } catch (error) {
    lastObservation = { attempt, error: error?.message || String(error) };
    console.log(`Runtime convergence attempt ${attempt}/${maxAttempts} failed safely: ${lastObservation.error}`);
  }
  if (attempt < maxAttempts) await sleep(retryMs);
}

throw new Error(`PRODUCTION_RUNTIME_DID_NOT_CONVERGE:${expectedSha}:${JSON.stringify(lastObservation)}`);
