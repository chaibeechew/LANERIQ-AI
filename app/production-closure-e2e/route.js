import { LANERIQ_18_PAGES } from "../../lib/product/laneriq-18-page-master.js";
import { getProductionBuildIdentity } from "../../lib/production-e2e/build-identity.js";

export const dynamic="force-dynamic";

function headers(){return {"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow, noarchive"};}
function lockedHtml(build){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>LANERIQ AI Production Closure — Locked</title></head><body style="margin:0;background:#020b08;color:#f5fff9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><main style="max-width:760px;margin:0 auto;padding:64px 20px"><p style="color:#d8bf62;font-weight:900;letter-spacing:.14em">LANERIQ AI · TRUTH GATE</p><h1>Production closure evidence is locked</h1><p style="line-height:1.6;color:#b7c9c0">This workflow can run only on an exact Vercel Production deployment built from <code>main</code> with a verifiable 40-character commit SHA. Preview, local and non-main deployments cannot execute Generate, Modify, Database, Workflow, Publish or Unpublish evidence.</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border-radius:14px;background:#061410">${JSON.stringify(build,null,2)}</pre></main></body></html>`;}

function pageHtml(build,pages){
  const safeBuild=JSON.stringify(build).replace(/</g,"\\u003c"),safePages=JSON.stringify(pages).replace(/</g,"\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>LANERIQ AI App Builder Production Closure E2E</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 82% 0,#6e51db2e,transparent 28%),linear-gradient(145deg,#020a12,#071622 56%,#03110d);color:#f7f4e9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:860px;margin:0 auto;padding:calc(28px + env(safe-area-inset-top)) 18px calc(50px + env(safe-area-inset-bottom))}.brand{font-size:12px;font-weight:900;letter-spacing:.16em;color:#e1bd58}.hero{margin:8px 0 20px}h1{font-size:clamp(30px,7vw,46px);line-height:1.02;margin:8px 0}p{color:#afbeb7;line-height:1.55}.card{padding:18px;border:1px solid #8d763d78;border-radius:22px;background:#071620de;box-shadow:0 28px 90px #0008;backdrop-filter:blur(16px)}textarea{width:100%;min-height:170px;padding:16px;border:1px solid #d9c98f;border-radius:16px;background:#f7f1e2;color:#17231f;font:inherit;font-size:16px;line-height:1.45;resize:vertical}.consent{display:flex;gap:12px;align-items:flex-start;margin:14px 0;padding:12px;border:1px solid #375d5b;border-radius:14px;background:#061a1a}.consent input{width:22px;height:22px;flex:0 0 22px}.consent label{font-size:14px;line-height:1.45;color:#c8d8d0}button,.link{width:100%;display:block;min-height:50px;margin-top:12px;padding:15px 18px;border-radius:16px;font:inherit;font-size:16px;font-weight:900;text-align:center;text-decoration:none;touch-action:manipulation}button{border:0;background:linear-gradient(135deg,#efcb64,#ad751c);color:#06110d}button:disabled{opacity:.44}.link{border:1px solid #496e7f;background:#0a2231;color:#ead078}#status,#report{margin-top:14px;padding:14px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere}#status{background:#071e2a;color:#d7e1dc;min-height:50px}#report{display:none;background:#020b11;border:1px solid #244151;font-size:12px;line-height:1.5}.ok{color:#78efa6!important}.bad{color:#ff9d94!important}.rule{margin-top:14px;padding:12px;border:1px solid #314e57;border-radius:14px;background:#061722;color:#b8c9c3;font-size:13px;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.pill{padding:12px;border-radius:14px;background:#06151d;border:1px solid #243f4a}.pill span{display:block;font-size:11px;color:#8fa39b}.pill b{display:block;margin-top:4px;font-size:13px;overflow-wrap:anywhere}button:focus-visible,.link:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid #efca64;outline-offset:3px}@media(max-width:620px){.grid{grid-template-columns:1fr}.card{padding:15px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>
<script id="laneriq-production-build" type="application/json">${safeBuild}</script>
<script id="laneriq-production-surfaces" type="application/json">${safePages}</script>
<script src="/production-closure-e2e-v3.js" defer></script>
</head>
<body>
<main>
  <div class="brand">LANERIQ AI · APP BUILDER · AUTHENTICATED PRODUCTION CLOSURE V3</div>
  <section class="hero"><h1>Plan → Build → Modify → Version → Data → Workflow → 18 Pages → Publish</h1><p>One authenticated exact-main Production journey with a durable server-verified receipt. Critical stages are rechecked against persisted App, version, Database and Workflow state before the receipt can reach PASS.</p></section>
  <section class="card">
    <textarea id="idea">Create a polished mobile-first property CRM App and responsive customer Website with clients, properties, enquiries, appointments, notes and a clear contact journey.</textarea>
    <div class="consent"><input id="consent" type="checkbox" /><label for="consent"><b>I understand this test creates and modifies a real private test project, saves Database/Workflow test metadata, and briefly publishes the exact reviewed version.</b><br/>Workflow execution uses Safe Test only. LANERIQ AI automatically disables the test workflow and unpublishes the project. A privacy-bounded server receipt stores verification metadata and a SHA-256 report digest, not the raw prompt, credentials, email or provider secrets.</label></div>
    <button id="run" disabled>RUN 18-STAGE PRODUCTION CLOSURE + SAVE RECEIPT</button>
    <a class="link" href="/auth?next=%2Fproduction-closure-e2e">Sign in / Verify Email</a>
    <div class="grid"><div class="pill"><span>Server Production SHA</span><b id="sha">—</b></div><div class="pill"><span>Durable evidence receipt</span><b id="receipt-state">Not started</b></div></div>
    <div class="rule"><b>Truth boundary:</b> server verification covers persisted ownership/version state, provider-hidden Database model rollback, Workflow Safe Test persistence, exact-version publish and final private state. Authenticated/anonymous page-health checks remain browser evidence. This does not claim physical-device execution, a specific external AI provider, physical database-table migration, Apple/Google Store submission, Email delivery, WhatsApp delivery or SMS.</div>
    <div id="status">Ready. Sign in, review the consent, then run the 18-stage closure journey.</div>
    <pre id="report"></pre>
    <button id="copy" type="button" style="display:none;background:#0b2733;color:#e9d07b;border:1px solid #496e7f">COPY EVIDENCE REPORT</button>
  </section>
</main>
</body>
</html>`;
}

export async function GET(){
  const build=getProductionBuildIdentity();
  if(!build.exactProductionBuildVerified)return new Response(lockedHtml(build),{status:200,headers:headers()});
  const pages=LANERIQ_18_PAGES.map(({id,name,route})=>({id,name,route}));
  return new Response(pageHtml(build,pages),{status:200,headers:headers()});
}
