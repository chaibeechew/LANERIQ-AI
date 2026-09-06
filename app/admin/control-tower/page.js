import Link from "next/link";
import LiveReleasePanel from "./LiveReleasePanel.js";

const MODULES = [
  ["Master Roadmap", "Vision → releases → capabilities → delivery."],
  ["Current Release", "Track the active release train, readiness and blockers."],
  ["Workstreams", "Coordinate UI, App Builder, Game Builder, AI Media, Security, Cloud and Production Control."],
  ["Dependency Graph", "See what must land first and what is waiting on another workstream."],
  ["Release Gates", "CI, security, database, API, performance, accessibility and exact-SHA verification."],
  ["Risk Register", "Record release, provider, cost, security and compliance risks."],
  ["Decision Log", "Preserve architecture and product decisions so retired designs do not return accidentally."],
  ["Deprecated Registry", "Track retired pages, flows, APIs and UI patterns without exposing them to users."],
  ["Evidence Center", "Collect screenshots, test evidence, benchmark output and production verification."],
];

const FLOW = [
  "Idea",
  "Planned",
  "Ready",
  "In Progress",
  "Code Complete",
  "Verification",
  "Release Candidate",
  "Production",
  "Observed",
  "Closed",
];

export const metadata = {
  title: "LANERIQ AI · Control Tower",
};

export default function ControlTowerPage() {
  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">LANERIQ AI · INTERNAL</div>
            <h1>Control Tower</h1>
          </div>
          <div className="badge">Owner / Admin only</div>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">PROGRAM & RELEASE MANAGEMENT</div>
            <h2>One app. Two experiences.</h2>
            <p>
              Customer product surfaces stay simple. Internal product, engineering and production control live behind protected admin routes in the same LANERIQ AI application.
            </p>
          </div>
          <div className="principle">
            <strong>Release truth</strong>
            <span>Product Version + Intelligence Layer + Release Stage + Exact Build SHA</span>
          </div>
        </section>

        <LiveReleasePanel />

        <section className="section">
          <div className="sectionHead">
            <div>
              <div className="eyebrow">CONTROL SURFACES</div>
              <h3>Management modules</h3>
            </div>
            <span className="muted">Foundation v2 · live release truth</span>
          </div>
          <div className="grid">
            {MODULES.map(([title, description]) => (
              <article className="card" key={title}>
                <div className="dot" />
                <h4>{title}</h4>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split">
          <div className="panel">
            <div className="eyebrow">DELIVERY STATE MACHINE</div>
            <h3>One status language</h3>
            <div className="flow">
              {FLOW.map((item, index) => (
                <span key={item}>{index + 1}. {item}</span>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="eyebrow">EXISTING ADMIN TOOLS</div>
            <h3>Internal operations</h3>
            <nav className="links">
              <Link href="/admin/creator-opportunities">Creator Opportunities <span>→</span></Link>
              <Link href="/admin/creator-support">Creator Support <span>→</span></Link>
              <Link href="/admin/promo">Promo Admin <span>→</span></Link>
            </nav>
          </div>
        </section>

        <footer>
          <span>Internal controls are never part of the ordinary customer navigation.</span>
          <span>Public users see only product version, available features, release notes and service status.</span>
        </footer>
      </div>
      <style>{`
        .page{min-height:100vh;background:radial-gradient(circle at 12% 0%,#162934 0,#081217 38%,#05090c 100%);color:#f7fbff;padding:28px 0 72px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{width:min(1180px,calc(100% - 30px));margin:0 auto}.topbar{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:18px}.topbar h1{margin:3px 0 0;font-size:clamp(28px,4vw,42px);letter-spacing:-.04em}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.17em;color:#95b7c8}.badge{border:1px solid #ffffff1f;background:#ffffff0d;padding:9px 12px;border-radius:999px;font-size:11px;font-weight:800}.hero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.7fr);gap:16px;border:1px solid #ffffff17;background:linear-gradient(145deg,#11242dcc,#0a1319dd);padding:clamp(24px,5vw,48px);border-radius:28px;box-shadow:0 28px 90px #0008}.hero h2{font-size:clamp(42px,8vw,78px);line-height:.95;letter-spacing:-.06em;margin:10px 0 20px}.hero p{max-width:720px;color:#b8c9d2;line-height:1.7;font-size:15px}.principle{align-self:end;border:1px solid #ffffff17;background:#061015;border-radius:20px;padding:20px;display:grid;gap:8px}.principle strong{font-size:13px}.principle span{font-size:12px;color:#9fb2bc;line-height:1.55}.section{margin-top:28px}.sectionHead{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:12px}.section h3{margin:5px 0 0;font-size:24px;letter-spacing:-.03em}.muted{font-size:11px;color:#78909b}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card,.panel{border:1px solid #ffffff13;background:#0b151bd9;border-radius:20px;padding:20px}.card{min-height:150px}.dot{width:9px;height:9px;border-radius:50%;background:#a8d7eb;box-shadow:0 0 20px #a8d7eb80}.card h4{font-size:17px;margin:16px 0 8px}.card p{margin:0;color:#91a7b2;line-height:1.55;font-size:12px}.split{display:grid;grid-template-columns:1.2fr .8fr;gap:12px}.flow{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.flow span{border:1px solid #ffffff16;background:#071116;border-radius:999px;padding:8px 10px;font-size:10px;color:#bdd0da}.links{display:grid;gap:9px;margin-top:18px}.links a{display:flex;justify-content:space-between;gap:10px;text-decoration:none;color:#ecf8ff;border:1px solid #ffffff12;background:#071116;padding:12px 14px;border-radius:13px;font-size:12px;font-weight:800}.links a:hover{border-color:#a8d7eb66}.links span{color:#7fb5cc}footer{display:flex;justify-content:space-between;gap:20px;margin-top:26px;border-top:1px solid #ffffff10;padding-top:18px;color:#718791;font-size:10px;line-height:1.5}@media(max-width:850px){.hero,.split{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.principle{align-self:auto}}@media(max-width:560px){.page{padding-top:18px}.topbar{align-items:flex-start}.badge{font-size:9px}.hero{padding:22px;border-radius:22px}.hero h2{font-size:44px}.grid{grid-template-columns:1fr}.card{min-height:auto}.sectionHead{align-items:flex-start}.muted{display:none}footer{display:grid}}
      `}</style>
    </main>
  );
}
