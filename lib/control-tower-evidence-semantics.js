const SHA40 = /^[0-9a-f]{40}$/i;

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function capturedMs(item) {
  const value = clean(item?.metadata?.captured_at) || clean(item?.updated_at) || clean(item?.created_at);
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function latest(items, kind) {
  return items
    .filter((item) =>
      String(item?.item_type || "").toLowerCase() === "evidence" &&
      String(item?.metadata?.kind || "").toLowerCase() === kind,
    )
    .sort((a, b) => capturedMs(b) - capturedMs(a))[0] || null;
}

function passWord(value) {
  return ["pass", "passed", "success", "successful", "ready", "verified"].includes(String(value || "").trim().toLowerCase());
}

function explicitPass(snapshot) {
  if (snapshot?.passed === true || snapshot?.success === true || snapshot?.verified === true) return true;
  return passWord(snapshot?.state) || passWord(snapshot?.status) || passWord(snapshot?.conclusion);
}

function result(kind, pass, reason, details = {}) {
  return { kind, pass: Boolean(pass), state: pass ? "pass" : "fail", reason: pass ? null : reason, ...details };
}

export function evaluateControlTowerMachineEvidenceSemantics({ items = [], liveStatus = null } = {}) {
  const mainSha = clean(liveStatus?.github?.mainSha)?.toLowerCase() || null;
  const runtimeSha = clean(liveStatus?.runtime?.commitSha)?.toLowerCase() || null;
  const exactSha = Boolean(mainSha && runtimeSha && mainSha === runtimeSha && SHA40.test(mainSha));

  const ci = latest(items, "github_ci");
  const ciSnapshot = ci?.metadata?.snapshot || {};
  const ciState = String(ciSnapshot.state || ciSnapshot.status || ciSnapshot.conclusion || "").toLowerCase();
  const ciPass = ciState === "success" && (finite(ciSnapshot.failed) ?? 0) === 0 && (finite(ciSnapshot.pending) ?? 0) === 0;

  const security = latest(items, "security");
  const securitySnapshot = security?.metadata?.snapshot || {};
  const securityCritical = finite(securitySnapshot.critical_vulnerabilities ?? securitySnapshot.criticalVulnerabilities ?? securitySnapshot.critical);
  const securityHigh = finite(securitySnapshot.high_vulnerabilities ?? securitySnapshot.highVulnerabilities ?? securitySnapshot.high);
  const securityPass = explicitPass(securitySnapshot) && securityCritical === 0 && securityHigh === 0;

  const benchmark = latest(items, "benchmark");
  const benchmarkSnapshot = benchmark?.metadata?.snapshot || {};
  const benchmarkPass = explicitPass(benchmarkSnapshot) && Boolean(benchmarkSnapshot.slo || benchmarkSnapshot.availabilityTarget || benchmarkSnapshot.availability_target);

  const deployment = latest(items, "vercel_deployment");
  const deploymentSnapshot = deployment?.metadata?.snapshot || {};
  const deploymentSha = clean(deploymentSnapshot.sha || deploymentSnapshot.commit_sha || deploymentSnapshot.commitSha)?.toLowerCase() || null;
  const deploymentEnvironment = String(deploymentSnapshot.environment || deploymentSnapshot.env || "").toLowerCase();
  const deploymentState = String(deploymentSnapshot.state || deploymentSnapshot.status || "").toLowerCase();
  const deploymentHealthy = deploymentSnapshot.healthy === true || String(deploymentSnapshot.health || "").toLowerCase() === "healthy";
  const deploymentVerified = deploymentSnapshot.verified === true || deploymentSnapshot.production_verified === true;
  const deploymentPass = exactSha && deploymentSha === mainSha && deploymentEnvironment === "production" && deploymentState === "ready" && deploymentHealthy && deploymentVerified;

  const migration = latest(items, "supabase_migration");
  const migrationSnapshot = migration?.metadata?.snapshot || {};
  const migrationVerified = migrationSnapshot.verified === true || passWord(migrationSnapshot.state) || passWord(migrationSnapshot.status);
  const driftDetected = migrationSnapshot.drift_detected ?? migrationSnapshot.driftDetected;
  const migrationPass = migrationVerified && driftDetected === false;

  const details = [
    result("github_ci", Boolean(ci) && ciPass, ci ? "ci_not_successful" : "missing", { stateObserved: ciState || null }),
    result("security", Boolean(security) && securityPass, security ? "security_policy_not_clean" : "missing", {
      criticalVulnerabilities: securityCritical,
      highVulnerabilities: securityHigh,
    }),
    result("benchmark", Boolean(benchmark) && benchmarkPass, benchmark ? "benchmark_not_explicitly_passed" : "missing"),
    result("vercel_deployment", Boolean(deployment) && deploymentPass, deployment ? "production_deployment_not_verified" : "missing", {
      deploymentSha,
      deploymentEnvironment: deploymentEnvironment || null,
      deploymentState: deploymentState || null,
    }),
    result("supabase_migration", Boolean(migration) && migrationPass, migration ? "migration_not_verified_or_drift_unknown" : "missing", {
      driftDetected: driftDetected ?? null,
    }),
  ];

  const passed = details.filter((entry) => entry.pass).length;
  return {
    healthy: passed === details.length,
    score: Math.round((passed / details.length) * 100),
    exactSha,
    failures: details.filter((entry) => !entry.pass).map((entry) => ({ kind: entry.kind, reason: entry.reason })),
    details,
  };
}
