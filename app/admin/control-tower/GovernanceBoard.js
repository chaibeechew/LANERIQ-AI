"use client";

import { useEffect, useMemo, useState } from "react";

const ITEM_TYPES = ["epic","feature","task","pr","dependency","risk","decision","deprecation","evidence"];
const PRIORITIES = ["p0","p1","p2","p3"];
const GATE_STATES = ["pending","pass","fail","waived"];

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/auth?next=${encodeURIComponent("/admin/control-tower")}`);
    return null;
  }
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function GovernanceBoard() {
  const [releases, setReleases] = useState([]);
  const [releaseId, setReleaseId] = useState("");
  const [items, setItems] = useState([]);
  const [gates, setGates] = useState([]);
  const [storageReady, setStorageReady] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [itemForm, setItemForm] = useState({ itemType: "risk", title: "", priority: "p2", description: "" });
  const [gateForm, setGateForm] = useState({ gateKey: "", label: "", state: "pending", required: true, detail: "" });

  async function loadReleases() {
    const data = await loadJson("/api/admin/control-tower/releases");
    if (!data) return;
    setStorageReady(data.storageReady !== false);
    const next = data.releases || [];
    setReleases(next);
    setReleaseId((current) => current || next.find((release) => release.release_status === "active")?.id || next[0]?.id || "");
  }

  async function loadGovernance(id) {
    if (!id) { setItems([]); setGates([]); return; }
    const [itemData, gateData] = await Promise.all([
      loadJson(`/api/admin/control-tower/items?releaseId=${encodeURIComponent(id)}`),
      loadJson(`/api/admin/control-tower/gates?releaseId=${encodeURIComponent(id)}`),
    ]);
    if (!itemData || !gateData) return;
    setStorageReady(itemData.storageReady !== false && gateData.storageReady !== false);
    setItems(itemData.items || []);
    setGates(gateData.gates || []);
  }

  useEffect(() => { void loadReleases().catch((e) => setError(e.message)); }, []);
  useEffect(() => { void loadGovernance(releaseId).catch((e) => setError(e.message)); }, [releaseId]);

  const counts = useMemo(() => ({
    risks: items.filter((item) => item.item_type === "risk").length,
    decisions: items.filter((item) => item.item_type === "decision").length,
    deprecated: items.filter((item) => item.item_type === "deprecation").length,
    blockers: items.filter((item) => item.priority === "p0" || item.priority === "p1").length,
    failedGates: gates.filter((gate) => gate.required && gate.state === "fail").length,
    pendingGates: gates.filter((gate) => gate.required && gate.state === "pending").length,
  }), [items, gates]);

  async function createItem(event) {
    event.preventDefault();
    if (!releaseId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/control-tower/items", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...itemForm, releaseId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create item.");
      setItemForm((current) => ({ ...current, title: "", description: "" }));
      await loadGovernance(releaseId);
    } catch (e) { setError(e.message || "Unable to create item."); }
    finally { setBusy(false); }
  }

  async function saveGate(event) {
    event.preventDefault();
    if (!releaseId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/control-tower/gates", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...gateForm, releaseId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save gate.");
      setGateForm((current) => ({ ...current, gateKey: "", label: "", detail: "" }));
      await loadGovernance(releaseId);
    } catch (e) { setError(e.message || "Unable to save gate."); }
    finally { setBusy(false); }
  }

  return (
    <section className="ctGovernance" aria-label="Control Tower governance board">
      <div className="ctGovernanceHead">
        <div><small>GOVERNANCE</small><h3>Risks · Decisions · Deprecations · Gates</h3></div>
        <select value={releaseId} onChange={(event) => setReleaseId(event.target.value)} aria-label="Select release">
          <option value="">Select release</option>
          {releases.map((release) => <option key={release.id} value={release.id}>{release.release_version} · {release.release_status}</option>)}
        </select>
      </div>

      {!storageReady ? <div className="ctNotice">Management storage is staged but not active in this environment yet.</div> : null}
      {error ? <div className="ctError" role="alert">{error}</div> : null}

      <div className="ctMetrics">
        <article><b>{counts.risks}</b><span>Risks</span></article>
        <article><b>{counts.decisions}</b><span>Decisions</span></article>
        <article><b>{counts.deprecated}</b><span>Deprecated</span></article>
        <article><b>{counts.blockers}</b><span>P0/P1 items</span></article>
        <article><b>{counts.failedGates}</b><span>Failed gates</span></article>
        <article><b>{counts.pendingGates}</b><span>Pending gates</span></article>
      </div>

      <div className="ctColumns">
        <div className="ctPanel">
          <h4>Register governance item</h4>
          <form onSubmit={createItem} className="ctForm">
            <div className="ctRow">
              <select value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}>{ITEM_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              <select value={itemForm.priority} onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
            </div>
            <input placeholder="Title" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} required />
            <textarea placeholder="Description / impact / decision context" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <button disabled={busy || !releaseId}>Add item</button>
          </form>
          <div className="ctList">
            {items.slice(0, 12).map((item) => <article key={item.id}><div><span>{item.item_type}</span><span>{item.priority}</span></div><b>{item.title}</b><small>{item.stage}</small></article>)}
            {releaseId && !items.length ? <p>No governance items for this release.</p> : null}
          </div>
        </div>

        <div className="ctPanel">
          <h4>Release gates</h4>
          <form onSubmit={saveGate} className="ctForm">
            <div className="ctRow">
              <input placeholder="gate-key" value={gateForm.gateKey} onChange={(e) => setGateForm({ ...gateForm, gateKey: e.target.value })} required />
              <select value={gateForm.state} onChange={(e) => setGateForm({ ...gateForm, state: e.target.value })}>{GATE_STATES.map((state) => <option key={state}>{state}</option>)}</select>
            </div>
            <input placeholder="Gate label" value={gateForm.label} onChange={(e) => setGateForm({ ...gateForm, label: e.target.value })} required />
            <textarea placeholder="Evidence / blocking detail" value={gateForm.detail} onChange={(e) => setGateForm({ ...gateForm, detail: e.target.value })} />
            <label className="ctCheck"><input type="checkbox" checked={gateForm.required} onChange={(e) => setGateForm({ ...gateForm, required: e.target.checked })} /> Required gate</label>
            <button disabled={busy || !releaseId}>Save gate</button>
          </form>
          <div className="ctList">
            {gates.map((gate) => <article key={gate.id}><div><span>{gate.required ? "required" : "optional"}</span><span>{gate.state}</span></div><b>{gate.label}</b><small>{gate.gate_key}</small></article>)}
            {releaseId && !gates.length ? <p>No release gates configured.</p> : null}
          </div>
        </div>
      </div>

      <style>{`
        .ctGovernance{margin-top:28px;border:1px solid #ffffff14;background:#081319d9;border-radius:24px;padding:20px}.ctGovernanceHead{display:flex;align-items:end;justify-content:space-between;gap:14px}.ctGovernanceHead small{color:#91b8c9;font-size:10px;letter-spacing:.16em;font-weight:900}.ctGovernanceHead h3{margin:5px 0 0;font-size:24px}.ctGovernance select,.ctGovernance input,.ctGovernance textarea{width:100%;box-sizing:border-box;border:1px solid #ffffff18;background:#061015;color:#eef9ff;border-radius:11px;padding:10px 11px;font:inherit}.ctGovernanceHead select{width:min(300px,100%)}.ctMetrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:16px}.ctMetrics article{border:1px solid #ffffff12;background:#0b171d;border-radius:14px;padding:12px}.ctMetrics b{display:block;font-size:24px}.ctMetrics span{font-size:10px;color:#8ea4ae}.ctColumns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.ctPanel{border:1px solid #ffffff12;background:#0a151b;border-radius:18px;padding:16px}.ctPanel h4{margin:0 0 12px}.ctForm{display:grid;gap:8px}.ctRow{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ctForm textarea{min-height:88px;resize:vertical}.ctForm button{border:0;border-radius:11px;padding:10px 12px;font-weight:900;background:#b8deef;color:#071015}.ctCheck{font-size:11px;color:#b6c7cf;display:flex;align-items:center;gap:8px}.ctCheck input{width:auto}.ctList{display:grid;gap:8px;margin-top:14px}.ctList article{border:1px solid #ffffff10;background:#061015;border-radius:12px;padding:10px}.ctList article div{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}.ctList article span,.ctList article small{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:#8198a3}.ctList article b{display:block;font-size:12px}.ctList p{font-size:11px;color:#748995}.ctNotice,.ctError{margin-top:12px;padding:10px 12px;border-radius:11px;font-size:11px}.ctNotice{background:#3b3517;color:#f2dfa2}.ctError{background:#4b2020;color:#ffd4d0}@media(max-width:900px){.ctMetrics{grid-template-columns:repeat(3,1fr)}.ctColumns{grid-template-columns:1fr}}@media(max-width:560px){.ctGovernanceHead{display:grid;align-items:start}.ctGovernanceHead select{width:100%}.ctMetrics{grid-template-columns:repeat(2,1fr)}.ctRow{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}
