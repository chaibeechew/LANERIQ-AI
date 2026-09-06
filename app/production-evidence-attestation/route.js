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
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>LANERIQ AI Production Evidence Attestation</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#5d47c52c,transparent 30%),linear-gradient(150deg,#020b0f,#071a1b 55%,#06120c);color:#f7f3e8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:900px;margin:0 auto;padding:calc(30px + env(safe-area-inset-top)) 18px calc(54px + env(safe-area-inset-bottom))}.brand{font-size:12px;font-weight:900;letter-spacing:.16em;color:#e4c45e}.hero h1{font-size:clamp(31px,7vw,48px);line-height:1.03;margin:8px 0}.hero p{color:#b4c4bd;line-height:1.6}.card{margin-top:18px;padding:18px;border:1px solid #816f3f88;border-radius:22px;background:#061820dc;box-shadow:0 28px 90px #0008}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.pill{padding:12px;border:1px solid #28484a;border-radius:14px;background:#051719}.pill span{display:block;font-size:11px;color:#8ea29b}.pill b{display:block;margin-top:4px;font-size:13px;overflow-wrap:anywhere}textarea{width:100%;min-height:280px;padding:16px;border:1px solid #d7c681;border-radius:16px;background:#f6f0e1;color:#17241f;font:inherit;font-size:16px;line-height:1.45;resize:vertical}button,.link{display:block;width:100%;min-height:50px;margin-top:12px;padding:15px 18px;border-radius:16px;font:inherit;font-size:16px;font-weight:900;text-align:center;text-decoration:none;touch-action:manipulation}button{border:0;background:linear-gradient(135deg,#efd06d,#ab781f);color:#06100d}.link{border:1px solid #486c7c;background:#0a2230;color:#ead27e}.rule,#status,#result{margin-top:14px;padding:13px;border-radius:14px}.rule{border:1px solid #294750;background:#061720;color:#b9c9c3;font-size:13px;line-height:1.55}#status{background:#071f28;color:#d7e3dd;min-height:48px}#result{display:none;background:#020b10;border:1px solid #27444d;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5}.ok{color:#7ef0a9!important}.bad{color:#ff9f96!important}button:focus-visible,.link:focus-visible,textarea:focus-visible{outline:3px solid #efcc65;outline-offset:3px}@media(max-width:620px){.grid{grid-template-columns:1fr}.card{padding:15px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<main>
  <div class="brand">LANERIQ AI · AUTHENTICATED PRODUCTION RELEASE PROOF</div>
  <section class="hero"><h1>Server-attest the 18-stage Production closure</h1><p>Paste the successful evidence report from the authenticated Production Closure. The server will bind it to the current signed-in user, exact Production <code>main</code> SHA, owned project, exact current version and verified private-after-test state before issuing an attestation ID and SHA-256 report hash.</p></section>
  <section class="card">
    <div class="grid"><div class="pill"><span>Active Production SHA</span><b id="sha">__SHA__</b></div><div class="pill"><span>Attestation type</span><b>Server-bound · tamper-evident · no persistent-audit claim</b></div></div>
    <textarea id="evidence" spellcheck="false" placeholder="Paste the complete successful JSON report from /production-closure-e2e"></textarea>
    <button id="attest" type="button">VERIFY & ISSUE SERVER ATTESTATION</button>
    <a class="link" href="/production-closure-e2e">Run the 18-stage Production Closure</a>
    <div class="rule"><b>Truth boundary:</b> the attestation proves server-side binding and rechecks current project ownership/private state. It is tamper-evident through SHA-256, but it is not claimed as a cryptographic signature or persistent external audit record. Physical-device, provider-LIVE, physical database migration, official-store, Email, WhatsApp and SMS evidence remain separate.</div>
    <div id="status">Ready. Paste a successful Production closure report.</div>
    <pre id="result"></pre>
    <button id="copy" type="button" style="display:none;background:#0b2933;color:#ead27e;border:1px solid #496e7d">COPY ATTESTATION</button>
  </section>
</main>
<script>
(function(){
  const input=document.getElementById('evidence');const attest=document.getElementById('attest');const status=document.getElementById('status');const result=document.getElementById('result');const copy=document.getElementById('copy');
  function setStatus(text,kind){status.textContent=text;status.className=kind||''}
  function show(value){result.style.display='block';result.textContent=JSON.stringify(value,null,2);copy.style.display='block'}
  attest.addEventListener('click',async function(){
    let report;try{report=JSON.parse(input.value)}catch{setStatus('Invalid JSON. Paste the complete evidence report.','bad');return}
    attest.disabled=true;result.style.display='none';copy.style.display='none';setStatus('Verifying authenticated Production evidence…');
    try{
      const response=await fetch('/api/production-e2e/attest',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({report:report})});
      const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
      if(!response.ok)throw new Error(data.error||('Attestation failed ('+response.status+')'));
      setStatus('PASS — server attestation issued and current private state verified.','ok');show({report:report,attestation:data});
    }catch(error){setStatus('FAILED — '+(error&&error.message||'Unable to attest evidence.'),'bad')}
    finally{attest.disabled=false}
  });
  copy.addEventListener('click',async function(){try{await navigator.clipboard.writeText(result.textContent);setStatus('Attestation copied.','ok')}catch{setStatus('Copy is unavailable. Select the attestation manually.','bad')}});
})();
</script>
</body>
</html>`;

export async function GET() {
  const build = buildIdentity();
  if (!build.exactProductionBuildVerified) return new Response(lockedHtml(build), { status: 200, headers: headers() });
  return new Response(HTML.replace("__SHA__", build.commitSha), { status: 200, headers: headers() });
}
