export const dynamic = "force-dynamic";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function buildIdentity() {
  const commitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const commitRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
  const environment = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  return Object.freeze({
    commitSha,
    commitRef,
    environment,
    exactProductionBuildVerified: environment === "production" && commitRef === "main" && COMMIT_SHA.test(commitSha),
  });
}

function headers() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function lockedHtml(build) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LANERIQ AI Evidence Attestation — Locked</title></head><body style="margin:0;background:#03100d;color:#f4fff9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><main style="max-width:760px;margin:0 auto;padding:64px 20px"><p style="color:#d9bd5e;font-weight:900;letter-spacing:.14em">LANERIQ AI · RELEASE PROOF</p><h1>Evidence attestation is locked</h1><p style="line-height:1.6;color:#b8cac1">This verifier runs only on an exact Vercel Production deployment built from <code>main</code>. Preview and local deployments cannot issue Production release attestations.</p><pre style="padding:14px;border-radius:14px;background:#071912;white-space:pre-wrap;overflow-wrap:anywhere">${JSON.stringify(build, null, 2)}</pre></main></body></html>`;
}

const HTML = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" /><title>LANERIQ AI Production Evidence Attestation</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#03100d;color:#f7f3e8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:900px;margin:0 auto;padding:calc(30px + env(safe-area-inset-top)) 18px calc(54px + env(safe-area-inset-bottom))}.brand{font-size:12px;font-weight:900;letter-spacing:.16em}.hero h1{font-size:clamp(31px,7vw,48px);line-height:1.03}.card{margin-top:18px;padding:18px;border:1px solid #816f3f88;border-radius:22px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pill{padding:12px;border:1px solid #28484a;border-radius:14px}textarea{width:100%;min-height:280px;padding:16px;font-size:16px}button,.link{display:block;width:100%;min-height:50px;margin-top:12px;padding:15px 18px;font-size:16px;touch-action:manipulation}button:focus-visible,.link:focus-visible,textarea:focus-visible{outline:3px solid #efcc65}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head>
<body><main><div class="brand">LANERIQ AI · AUTHENTICATED PRODUCTION RELEASE PROOF</div><section class="hero"><h1>Server-attest the 18-stage Production closure</h1><p>Paste the successful evidence report from the authenticated Production Closure.</p></section><section class="card"><div class="grid"><div class="pill"><span>Active Production SHA</span><b id="sha">__SHA__</b></div><div class="pill"><span>Attestation type</span><b>Server-bound · tamper-evident · no persistent-audit claim</b></div></div><textarea id="evidence" spellcheck="false" placeholder="Paste the complete successful JSON report from /production-closure-e2e"></textarea><button id="attest" type="button">VERIFY & ISSUE SERVER ATTESTATION</button><a class="link" href="/production-closure-e2e">Run the 18-stage Production Closure</a><div class="rule"><b>Truth boundary:</b> the attestation is tamper-evident through SHA-256, but it is not claimed as a cryptographic signature or persistent external audit record.</div><div id="status">Ready.</div><pre id="result"></pre><button id="copy" type="button">COPY ATTESTATION</button></section></main>
<script>(function(){const input=document.getElementById('evidence');const attest=document.getElementById('attest');const status=document.getElementById('status');const result=document.getElementById('result');attest.addEventListener('click',async function(){let report;try{report=JSON.parse(input.value)}catch{status.textContent='Invalid JSON.';return}const response=await fetch('/api/production-e2e/attest',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({report:report})});const text=await response.text();result.textContent=text;status.textContent=response.ok?'PASS':'FAILED'})})();</script></body></html>`;

export async function GET() {
  const build = buildIdentity();
  if (!build.exactProductionBuildVerified) return new Response(lockedHtml(build), { status: 200, headers: headers() });
  return new Response(HTML.replace("__SHA__", build.commitSha), { status: 200, headers: headers() });
}
