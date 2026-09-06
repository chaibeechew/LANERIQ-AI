"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "idea",
  "planned",
  "ready",
  "in_progress",
  "code_complete",
  "verification",
  "release_candidate",
  "production",
  "observed",
  "closed",
];

function stageLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null;
}

async function fetchJson(url, options) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/auth?next=${encodeURIComponent("/admin/control-tower")}`);
    return null;
  }
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.payload = data;
    throw error;
  }
  return data;
}

export default function ReadinessBoard() {
  const [releases, setReleases] = useState([]);
  const [releaseId, setReleaseId] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadReleases() {
    const result = await fetchJson("/api/admin/control-tower/releases");
    if (!result) return;
    const next = result.releases || [];
    setReleases(next);
    setReleaseId((current) => current || next.find((item) => item.release_status === "active")?.id || next[0]?.id || "");
  }

  async function loadReadiness(id) {
    if (!id) { setData(null); return; }
    const result = await fetchJson(`/api/admin/control-tower/readiness?releaseId=${encodeURIComponent(id)}`);
    if (result) setData(result);
  }

  useEffect(() => { void loadReleases().catch((e) => setError(e.message)); }, []);
  useEffect(() => { void loadReadiness(releaseId).catch((e) => setError(e.message)); }, [releaseId]);

  async function initializeGates() {
    if (!releaseId) return;
    setBusy(true); setError("");
    try {
      await fetchJson("/api/admin/control-tower/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId }),
      });
      await loadReadiness(releaseId);
    } catch (e) {
      setError(e.message || "Unable to initialize gates.");
    } finally {
      setBusy(false);
    }
  }

  async function advanceRelease() {
    const release = data?.release;
    const targetStage = nextStage(release?.stage);
    if (!release || !targetStage) return;
    setBusy(true); setError("");
    try {
      await fetchJson("/api/admin/control-tower/promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId: release.id,
          targetStage,
          expectedUpdatedAt: release.updated_at,
        }),
      });
      await Promise.all([loadReleases(), loadReadiness(release.id)]);
    } catch (e) {
      setError(e.message || "Unable to advance release.");
      if (e.payload?.scorecard) setData((current) => current ? { ...current, scorecard: e.payload.scorecard } : current);
    } finally {
      setBusy(false);
    }
  }

  const scorecard = data?.scorecard;
  const coverage = scorecard?.gateCoverage;
  const dependency = scorecard?.dependency;
  const release = data?.release;
  const targetStage = nextStage(release?.stage);
  const capabilities = data?.capabilities || {};
  const promotionDisabled = !targetStage || busy ||
    (targetStage === "release_candidate" && !scorecard?.rcEligible) ||
    (targetStage === "production" && (!scorecard?.productionEligible || !capabilities.promoteProduction || release?.release_status !== "active"));

  return (
    <section className="ctReadiness" aria-label="Control Tower release readiness">
      <div className="ctReadinessHead">
        <div><small>RELEASE GOVERNANCE ENGINE</small><h3>Readiness · Dependencies · Promotion</h3></div>
        <select value={releaseId} onChange={(event) => setReleaseId(event.target.value)} aria-label="Select release for readiness">
          <option value="">Select release</option>
          {releases.map((item) => <option value={item.id} key={item.id}>{item.release_version} · {item.stage}</option>)}
        </select>
      </div>

      {error ? <div className="ctReadinessError" role="alert">{error}</div> : null}
      {data?.storageReady === false ? <div className="ctReadinessNotice">Management storage is staged but not active in this environment.</div> : null}

      {scorecard ? <>
        <div className="ctReadinessHero">
          <div><strong>{scorecard.overall}</strong><span>RC readiness / 100</span></div>
          <div className="ctPromotion">
            <div>
              <b>{scorecard.productionEligible ? "PRODUCTION ELIGIBLE" : scorecard.rcEligible ? "RC ELIGIBLE" : "BLOCKED / IN PROGRESS"}</b>
              <span>{scorecard.hardBlockers.length ? scorecard.hardBlockers.join(" · ") : "No Release Candidate blockers detected."}</span>
            </div>
            {targetStage ? <button disabled={promotionDisabled} onClick={advanceRelease}>
              Advance → {stageLabel(targetStage)}
            </button> : <span>Lifecycle complete.</span>}
            {targetStage === "production" && !capabilities.promoteProduction ? <small>Production promotion requires Owner / Super Admin.</small> : null}
          </div>
        </div>

        <div className="ctDimensionGrid">
          {Object.entries(scorecard.dimensions || {}).map(([key, value]) => (
            <article key={key}><b>{value}</b><span>{key.replace(/([A-Z])/g, " $1")}</span></article>
          ))}
        </div>

        <div className="ctReadinessColumns">
          <article className="ctReadinessPanel">
            <div className="ctPanelHead"><h4>Release gates</h4><button disabled={busy || !releaseId} onClick={initializeGates}>Initialize standard gates</button></div>
            <div className="ctFacts">
              <span>RC coverage <b>{coverage?.rcStandardPresent ?? 0}/{coverage?.rcStandardRequired ?? 0}</b></span>
              <span>Production coverage <b>{coverage?.productionStandardPresent ?? 0}/{coverage?.productionStandardRequired ?? 0}</b></span>
              <span>Pass <b>{coverage?.pass ?? 0}</b></span>
              <span>Pending <b>{coverage?.pending ?? 0}</b></span>
              <span>Fail <b>{coverage?.fail ?? 0}</b></span>
              <span>Waived <b>{coverage?.waived ?? 0}</b></span>
            </div>
          </article>

          <article className="ctReadinessPanel">
            <h4>Dependency health</h4>
            <div className="ctFacts">
              <span>Missing <b>{dependency?.missing?.length ?? 0}</b></span>
              <span>Blocked <b>{dependency?.blocked?.length ?? 0}</b></span>
              <span>Cycles <b>{dependency?.cycles?.length ?? 0}</b></span>
              <span>P0/P1 <b>{scorecard.openCriticalItems?.length ?? 0}</b></span>
            </div>
          </article>
        </div>

        {scorecard.effectiveProductionGates?.length ? <div className="ctLiveGates">
          {scorecard.effectiveProductionGates.map((gate) => <article key={gate.gate_key}><span>{gate.gate_key}</span><b>{gate.state}</b><small>{gate.detail}</small></article>)}
        </div> : null}

        {release?.stage === "release_candidate" && scorecard.productionBlockers?.length ? <div className="ctProductionBlockers">
          <b>Production blockers</b>
          <span>{scorecard.productionBlockers.join(" · ")}</span>
        </div> : null}

        {scorecard.openCriticalItems?.length ? <div className="ctBlockerList">
          {scorecard.openCriticalItems.slice(0, 8).map((item) => <article key={item.id}><span>{item.priority}</span><b>{item.title}</b><small>{item.stage}</small></article>)}
        </div> : null}
      </> : null}

      <style>{`
        .ctReadiness{margin-top:28px;border:1px solid #ffffff14;background:#081319d9;border-radius:24px;padding:20px}.ctReadinessHead{display:flex;justify-content:space-between;align-items:end;gap:14px}.ctReadinessHead small{font-size:10px;font-weight:900;letter-spacing:.16em;color:#91b8c9}.ctReadinessHead h3{margin:5px 0 0;font-size:24px}.ctReadinessHead select{width:min(300px,100%);border:1px solid #ffffff18;background:#061015;color:#eef9ff;border-radius:11px;padding:10px 11px}.ctReadinessHero{display:grid;grid-template-columns:220px 1fr;gap:12px;margin-top:16px}.ctReadinessHero>div{border:1px solid #ffffff12;background:#0b171d;border-radius:18px;padding:18px}.ctReadinessHero strong{font-size:52px;line-height:1;display:block}.ctReadinessHero span{display:block;margin-top:8px;font-size:11px;color:#8fa5af}.ctPromotion{display:flex;justify-content:space-between;align-items:center;gap:14px}.ctPromotion>div{min-width:0}.ctPromotion b{font-size:15px}.ctPromotion button,.ctPanelHead button{border:0;border-radius:10px;padding:9px 11px;background:#b8deef;color:#071015;font-weight:900;font-size:10px}.ctPromotion button:disabled,.ctPanelHead button:disabled{opacity:.45;cursor:not-allowed}.ctPromotion small{font-size:9px;color:#8fa5af}.ctDimensionGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.ctDimensionGrid article{border:1px solid #ffffff10;background:#061015;border-radius:14px;padding:12px}.ctDimensionGrid b{display:block;font-size:22px}.ctDimensionGrid span{text-transform:capitalize;font-size:9px;color:#8198a3}.ctReadinessColumns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.ctReadinessPanel{border:1px solid #ffffff10;background:#0a151b;border-radius:16px;padding:14px}.ctReadinessPanel h4{margin:0 0 10px}.ctPanelHead{display:flex;justify-content:space-between;align-items:center;gap:10px}.ctFacts{display:flex;flex-wrap:wrap;gap:8px}.ctFacts span{border:1px solid #ffffff10;background:#061015;border-radius:999px;padding:7px 9px;font-size:10px;color:#8fa5af}.ctFacts b{color:#eef9ff}.ctLiveGates{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.ctLiveGates article{border:1px solid #ffffff10;background:#061015;border-radius:12px;padding:10px}.ctLiveGates span,.ctLiveGates small{display:block;font-size:9px;color:#8198a3;word-break:break-word}.ctLiveGates b{display:block;margin:5px 0;font-size:11px;text-transform:uppercase}.ctProductionBlockers{margin-top:10px;border:1px solid #ffffff10;background:#231718;border-radius:12px;padding:11px}.ctProductionBlockers b,.ctProductionBlockers span{display:block}.ctProductionBlockers b{font-size:11px}.ctProductionBlockers span{margin-top:5px;font-size:10px;color:#d9aeb0}.ctBlockerList{display:grid;gap:7px;margin-top:10px}.ctBlockerList article{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;border:1px solid #ffffff10;background:#061015;border-radius:11px;padding:9px 10px}.ctBlockerList span,.ctBlockerList small{font-size:9px;text-transform:uppercase;color:#8fa5af}.ctBlockerList b{font-size:11px}.ctReadinessError,.ctReadinessNotice{margin-top:12px;border-radius:11px;padding:10px 12px;font-size:11px}.ctReadinessError{background:#4b2020;color:#ffd4d0}.ctReadinessNotice{background:#3b3517;color:#f2dfa2}@media(max-width:900px){.ctDimensionGrid{grid-template-columns:repeat(3,1fr)}.ctReadinessColumns{grid-template-columns:1fr}.ctLiveGates{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.ctReadinessHead{display:grid;align-items:start}.ctReadinessHead select{width:100%}.ctReadinessHero{grid-template-columns:1fr}.ctPromotion{align-items:flex-start;flex-direction:column}.ctDimensionGrid{grid-template-columns:repeat(2,1fr)}.ctLiveGates{grid-template-columns:1fr}.ctPanelHead{align-items:flex-start;flex-direction:column}}
      `}</style>
    </section>
  );
}
