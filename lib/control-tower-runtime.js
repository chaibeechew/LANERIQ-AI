const DEFAULT_REPOSITORY = Object.freeze({ owner: "chaibeechew", repo: "LANERIQ-AI" });

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortSha(value) {
  const sha = clean(value);
  return sha ? sha.slice(0, 12) : null;
}

function repositoryIdentity() {
  return {
    owner: clean(process.env.VERCEL_GIT_REPO_OWNER) || DEFAULT_REPOSITORY.owner,
    repo: clean(process.env.VERCEL_GIT_REPO_SLUG) || DEFAULT_REPOSITORY.repo,
  };
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "LANERIQ-Control-Tower",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = clean(process.env.LANERIQ_GITHUB_TOKEN) || clean(process.env.GITHUB_TOKEN);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubJson(path) {
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      cache: "no-store",
      headers: githubHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: await response.json() };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const SUCCESSFUL_CHECK_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
const FAILED_CHECK_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
  "stale",
]);

export function deriveGitHubCiState({ legacyState, checkRuns = [] }) {
  const legacy = clean(legacyState)?.toLowerCase() || "unknown";
  if (["failure", "error"].includes(legacy)) return "failure";

  const runs = Array.isArray(checkRuns) ? checkRuns : [];
  if (runs.some((run) => FAILED_CHECK_CONCLUSIONS.has(String(run?.conclusion || "").toLowerCase()))) return "failure";
  if (runs.some((run) => String(run?.status || "").toLowerCase() !== "completed" || !run?.conclusion)) return "pending";
  if (runs.length && runs.every((run) => SUCCESSFUL_CHECK_CONCLUSIONS.has(String(run?.conclusion || "").toLowerCase()))) return "success";
  if (legacy === "pending") return "pending";
  if (legacy === "success") return "success";
  return "unknown";
}

export function evaluateReleaseTruth({
  mainSha,
  runtimeSha,
  environment,
  ciState,
  supabaseConfigured,
}) {
  const normalizedEnvironment = clean(environment)?.toLowerCase() || "unknown";
  const exactSha = Boolean(mainSha && runtimeSha && mainSha === runtimeSha);
  const isProduction = normalizedEnvironment === "production";
  const ci = clean(ciState)?.toLowerCase() || "unknown";

  const gates = [
    {
      id: "github-main",
      label: "GitHub main identity",
      state: mainSha ? "pass" : "pending",
      detail: mainSha ? shortSha(mainSha) : "Main SHA unavailable",
    },
    {
      id: "runtime-identity",
      label: "Runtime build identity",
      state: runtimeSha ? "pass" : "pending",
      detail: runtimeSha ? shortSha(runtimeSha) : "Runtime SHA unavailable",
    },
    {
      id: "environment",
      label: "Production environment",
      state: isProduction ? "pass" : "pending",
      detail: normalizedEnvironment,
    },
    {
      id: "exact-sha",
      label: "Main = runtime exact SHA",
      state: isProduction ? (exactSha ? "pass" : mainSha && runtimeSha ? "fail" : "pending") : "pending",
      detail: exactSha ? "Exact match" : "Not yet verified on Production",
    },
    {
      id: "ci",
      label: "GitHub commit status / checks",
      state: ci === "success" ? "pass" : ["failure", "error"].includes(ci) ? "fail" : "pending",
      detail: ci,
    },
    {
      id: "supabase",
      label: "Supabase runtime configuration",
      state: supabaseConfigured ? "pass" : "fail",
      detail: supabaseConfigured ? "Configured" : "Missing runtime configuration",
    },
  ];

  const hasFailure = gates.some((gate) => gate.state === "fail");
  const productionVerified =
    isProduction && exactSha && ci === "success" && Boolean(supabaseConfigured) && !hasFailure;

  return {
    exactSha,
    productionVerified,
    state: productionVerified ? "verified" : hasFailure ? "blocked" : "pending",
    gates,
  };
}

export async function getControlTowerLiveStatus() {
  const repository = repositoryIdentity();
  const encodedOwner = encodeURIComponent(repository.owner);
  const encodedRepo = encodeURIComponent(repository.repo);

  const branch = await githubJson(`/repos/${encodedOwner}/${encodedRepo}/branches/main`);
  const mainSha = branch.ok ? clean(branch.data?.commit?.sha) : null;

  let ciState = "unknown";
  let ciTotal = 0;
  let checkRunsTotal = 0;
  let checkRunsSuccessful = 0;
  let checkRunsFailed = 0;
  let checkRunsPending = 0;
  let legacyStatusState = "unknown";

  if (mainSha) {
    const encodedSha = encodeURIComponent(mainSha);
    const [status, checks] = await Promise.all([
      githubJson(`/repos/${encodedOwner}/${encodedRepo}/commits/${encodedSha}/status`),
      githubJson(`/repos/${encodedOwner}/${encodedRepo}/commits/${encodedSha}/check-runs?per_page=100`),
    ]);

    if (status.ok) {
      legacyStatusState = clean(status.data?.state) || "unknown";
      ciTotal = Number.isFinite(status.data?.total_count) ? status.data.total_count : 0;
    }

    const checkRuns = checks.ok && Array.isArray(checks.data?.check_runs) ? checks.data.check_runs : [];
    checkRunsTotal = checkRuns.length;
    checkRunsSuccessful = checkRuns.filter((run) =>
      run?.status === "completed" && SUCCESSFUL_CHECK_CONCLUSIONS.has(String(run?.conclusion || "").toLowerCase()),
    ).length;
    checkRunsFailed = checkRuns.filter((run) => FAILED_CHECK_CONCLUSIONS.has(String(run?.conclusion || "").toLowerCase())).length;
    checkRunsPending = checkRuns.filter((run) => run?.status !== "completed" || !run?.conclusion).length;
    ciState = deriveGitHubCiState({ legacyState: legacyStatusState, checkRuns });
  }

  const runtimeSha = clean(process.env.VERCEL_GIT_COMMIT_SHA) || clean(process.env.LANERIQ_RUNTIME_SHA);
  const environment = clean(process.env.VERCEL_ENV) || clean(process.env.NODE_ENV) || "unknown";
  const supabaseConfigured = Boolean(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)),
  );

  const truth = evaluateReleaseTruth({
    mainSha,
    runtimeSha,
    environment,
    ciState,
    supabaseConfigured,
  });

  return {
    generatedAt: new Date().toISOString(),
    repository: `${repository.owner}/${repository.repo}`,
    github: {
      available: branch.ok,
      mainSha,
      mainShaShort: shortSha(mainSha),
      ciState,
      ciTotal,
      legacyStatusState,
      checkRunsTotal,
      checkRunsSuccessful,
      checkRunsFailed,
      checkRunsPending,
    },
    runtime: {
      environment,
      commitSha: runtimeSha,
      commitShaShort: shortSha(runtimeSha),
      branch: clean(process.env.VERCEL_GIT_COMMIT_REF),
      deploymentUrl: clean(process.env.VERCEL_URL),
      productionUrl: clean(process.env.VERCEL_PROJECT_PRODUCTION_URL),
      supabaseConfigured,
    },
    releaseTruth: truth,
  };
}
