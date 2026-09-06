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
    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }
    return { ok: true, status: response.status, data: await response.json() };
  } catch {
    return { ok: false, status: 0, data: null };
  }
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
      label: "GitHub commit status",
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
  let ciTotal = null;
  if (mainSha) {
    const status = await githubJson(
      `/repos/${encodedOwner}/${encodedRepo}/commits/${encodeURIComponent(mainSha)}/status`,
    );
    if (status.ok) {
      ciState = clean(status.data?.state) || "unknown";
      ciTotal = Number.isFinite(status.data?.total_count) ? status.data.total_count : null;
    }
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
