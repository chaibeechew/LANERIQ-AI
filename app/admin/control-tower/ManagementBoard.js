"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const RELEASE_STAGES = [
  ["planned", "Planned"],
  ["ready", "Ready"],
  ["in_progress", "In Progress"],
  ["code_complete", "Code Complete"],
  ["verification", "Verification"],
  ["release_candidate", "Release Candidate"],
  ["production", "Production"],
  ["observed", "Observed"],
];

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ManagementBoard() {
  const [releases, setReleases] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState("");
  const [storageReady, setStorageReady] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [releaseForm, setReleaseForm] = useState({
    productVersion: "",
    releaseVersion: "",
    capabilityLayer: "",
    releaseStatus: "backlog",
    stage: "planned",
  });
  const [workstreamForm, setWorkstreamForm] = useState({
    workstreamKey: "",
    name: "",
    stage: "planned",
    description: "",
  });

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/control-tower/releases", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load releases.");
      setStorageReady(payload.storageReady !== false);
      const next = payload.releases || [];
      setReleases(next);
      setSelectedReleaseId((current) => current || next.find((item) => item.release_status === "active")?.id || next[0]?.id || "");
    } catch (err) {
      setError(err?.message || "Unable to load releases.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkstreams = useCallback(async (releaseId) => {
    if (!releaseId) {
      setWorkstreams([]);
      return;
    }
    try {
      const response = await fetch(`/api/admin/control-tower/workstreams?releaseId=${encodeURIComponent(releaseId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load workstreams.");
      setWorkstreams(payload.workstreams || []);
    } catch (err) {
      setError(err?.message || "Unable to load workstreams.");
    }
  }, []);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  useEffect(() => {
    void loadWorkstreams(selectedReleaseId);
  }, [selectedReleaseId, loadWorkstreams]);

  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === selectedReleaseId) || null,
    [releases, selectedReleaseId],
  );

  async function createRelease(event) {
    event.preventDefault();
    setBusy("release");
    setError("");
    try {
      const response = await fetch("/api/admin/control-tower/releases", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(releaseForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create release.");
      setReleaseForm({ productVersion: "", releaseVersion: "", capabilityLayer: "", releaseStatus: "backlog", stage: "planned" });
      await loadReleases();
      if (payload.release?.id) setSelectedReleaseId(payload.release.id);
    } catch (err) {
      setError(err?.message || "Unable to create release.");
    } finally {
      setBusy("");
    }
  }

  async function createWorkstream(event) {
    event.preventDefault();
    if (!selectedReleaseId) return;
    setBusy("workstream");
    setError("");
    try {
      const response = await fetch("/api/admin/control-tower/workstreams", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workstreamForm, releaseId: selectedReleaseId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create workstream.");
      setWorkstreamForm({ workstreamKey: "", name: "", stage: "planned", description: "" });
      await loadWorkstreams(selectedReleaseId);
    } catch (err) {
      setError(err?.message || "Unable to create workstream.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="managementBoard">
      <div className="managementHead">
        <div>
          <div className="eyebrow">PROGRAM MANAGEMENT</div>
          <h3>Release & workstream board</h3>
          <p>Keep Current Release, Next Release and Backlog separate from customer-facing product navigation.</p>
        </div>
        <button type="button" onClick={loadReleases} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {error ? <div className="managementError" role="alert">{error}</div> : null}

      {storageReady === false ? (
        <div className="storagePending">
          <strong>Management storage staged, not active here yet.</strong>
          <span>The Control Tower database migration is in the Draft PR. Editing activates only after that migration reaches this environment through the normal release process.</span>
        </div>
      ) : null}

      {storageReady ? (
        <div className="managementGrid">
          <div className="managementPanel">
            <div className="panelHead"><h4>Releases</h4><span>{releases.length}</span></div>
            <div className="releaseList">
              {releases.length ? releases.map((release) => (
                <button
                  type="button"
                  key={release.id}
                  className="releaseRow"
                  data-active={release.id === selectedReleaseId}
                  onClick={() => setSelectedReleaseId(release.id)}
                >
                  <span><b>{release.product_version}</b><small>{release.release_version}</small></span>
                  <span className="releaseMeta"><i>{label(release.release_status)}</i><em>{label(release.stage)}</em></span>
                </button>
              )) : <p className="empty">No releases yet. Create the first release train below.</p>}
            </div>

            <form className="managementForm" onSubmit={createRelease}>
              <h5>Create release</h5>
              <div className="formGrid">
                <input required placeholder="Product version · LANERIQ AI 2.0" value={releaseForm.productVersion} onChange={(e) => setReleaseForm({ ...releaseForm, productVersion: e.target.value })} />
                <input required placeholder="Release version · v2.4.0" value={releaseForm.releaseVersion} onChange={(e) => setReleaseForm({ ...releaseForm, releaseVersion: e.target.value })} />
                <input placeholder="Capability layer" value={releaseForm.capabilityLayer} onChange={(e) => setReleaseForm({ ...releaseForm, capabilityLayer: e.target.value })} />
                <select value={releaseForm.releaseStatus} onChange={(e) => setReleaseForm({ ...releaseForm, releaseStatus: e.target.value })}>
                  <option value="active">Current Release</option><option value="next">Next Release</option><option value="backlog">Backlog</option><option value="archived">Archived</option>
                </select>
                <select value={releaseForm.stage} onChange={(e) => setReleaseForm({ ...releaseForm, stage: e.target.value })}>
                  {RELEASE_STAGES.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
                </select>
              </div>
              <button className="primary" disabled={busy === "release"}>{busy === "release" ? "Creating…" : "Create Release"}</button>
            </form>
          </div>

          <div className="managementPanel">
            <div className="panelHead"><div><h4>Workstreams</h4><small>{selectedRelease ? `${selectedRelease.product_version} · ${selectedRelease.release_version}` : "Select a release"}</small></div><span>{workstreams.length}</span></div>
            <div className="workstreamList">
              {workstreams.length ? workstreams.map((item) => (
                <article className="workstreamRow" key={item.id}>
                  <div><b>{item.name}</b><small>{item.workstream_key}</small></div>
                  <span>{label(item.stage)}</span>
                  {item.description ? <p>{item.description}</p> : null}
                </article>
              )) : <p className="empty">{selectedReleaseId ? "No workstreams in this release yet." : "Select or create a release first."}</p>}
            </div>

            <form className="managementForm" onSubmit={createWorkstream}>
              <h5>Add workstream</h5>
              <div className="formGrid">
                <input required disabled={!selectedReleaseId} placeholder="Key · ui" value={workstreamForm.workstreamKey} onChange={(e) => setWorkstreamForm({ ...workstreamForm, workstreamKey: e.target.value })} />
                <input required disabled={!selectedReleaseId} placeholder="Name · Living Intelligence UI" value={workstreamForm.name} onChange={(e) => setWorkstreamForm({ ...workstreamForm, name: e.target.value })} />
                <select disabled={!selectedReleaseId} value={workstreamForm.stage} onChange={(e) => setWorkstreamForm({ ...workstreamForm, stage: e.target.value })}>
                  {RELEASE_STAGES.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
                </select>
                <textarea disabled={!selectedReleaseId} placeholder="Scope / responsibility" value={workstreamForm.description} onChange={(e) => setWorkstreamForm({ ...workstreamForm, description: e.target.value })} />
              </div>
              <button className="primary" disabled={!selectedReleaseId || busy === "workstream"}>{busy === "workstream" ? "Adding…" : "Add Workstream"}</button>
            </form>
          </div>
        </div>
      ) : null}

      <style>{`
        .managementBoard{margin-top:28px}.managementHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:12px}.managementHead h3{margin:5px 0 7px;font-size:25px;letter-spacing:-.035em}.managementHead p{margin:0;color:#849aa5;font-size:11px;line-height:1.5}.managementHead>button{border:1px solid #ffffff1a;background:#0d1b22;color:#dcebf2;border-radius:11px;padding:9px 12px;font-weight:850}.managementGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.managementPanel{border:1px solid #ffffff13;background:#0b151bd9;border-radius:20px;padding:17px}.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.panelHead h4{margin:0;font-size:17px}.panelHead small{display:block;margin-top:4px;color:#728892;font-size:9px}.panelHead>span{min-width:28px;height:28px;border-radius:999px;display:grid;place-items:center;background:#ffffff0b;color:#a9bdc6;font-size:10px;font-weight:900}.releaseList,.workstreamList{display:grid;gap:7px;margin-top:13px;max-height:310px;overflow:auto}.releaseRow{width:100%;border:1px solid #ffffff10;background:#071116;color:#eaf6fb;border-radius:13px;padding:11px;display:flex;justify-content:space-between;gap:10px;text-align:left}.releaseRow[data-active="true"]{border-color:#8fd2ed55;background:#0d2029}.releaseRow b,.workstreamRow b{font-size:11px}.releaseRow small,.workstreamRow small{display:block;color:#708792;font-size:8px;margin-top:3px}.releaseMeta{display:flex;gap:5px;align-items:center}.releaseMeta i,.releaseMeta em,.workstreamRow>span{font-style:normal;font-size:8px;border-radius:999px;padding:5px 6px;background:#ffffff0b;color:#9cb0ba}.releaseMeta i{color:#8fd2ed}.workstreamRow{border:1px solid #ffffff10;background:#071116;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:8px}.workstreamRow p{grid-column:1/-1;margin:0;color:#78909b;font-size:9px;line-height:1.45}.managementForm{border-top:1px solid #ffffff0e;margin-top:15px;padding-top:14px}.managementForm h5{margin:0 0 9px;font-size:11px}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.formGrid input,.formGrid select,.formGrid textarea{min-width:0;border:1px solid #ffffff12;background:#071116;color:#dcebf2;border-radius:10px;padding:9px 10px;font:inherit;font-size:9px;outline:none}.formGrid textarea{grid-column:1/-1;min-height:66px;resize:vertical}.formGrid input:focus,.formGrid select:focus,.formGrid textarea:focus{border-color:#8fd2ed55}.primary{margin-top:8px;border:0;border-radius:10px;background:#dff5ff;color:#061116;padding:9px 11px;font-size:9px;font-weight:950}.primary:disabled{opacity:.45}.empty{margin:8px 0;color:#718791;font-size:10px;line-height:1.5}.managementError,.storagePending{margin:10px 0;border-radius:13px;padding:12px;font-size:10px}.managementError{border:1px solid #ff81733a;background:#361819;color:#ffc2bc}.storagePending{border:1px solid #e7c56e2d;background:#2b2414;color:#e9d59a;display:grid;gap:5px}.storagePending span{color:#ad9f75;line-height:1.5}@media(max-width:820px){.managementGrid{grid-template-columns:1fr}}@media(max-width:560px){.managementHead{display:grid}.managementHead>button{width:100%}.formGrid{grid-template-columns:1fr}.formGrid textarea{grid-column:auto}.releaseRow{display:grid}.releaseMeta{justify-content:flex-start}}
      `}</style>
    </section>
  );
}
