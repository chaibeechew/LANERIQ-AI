"use client";

import { useEffect, useMemo, useState } from "react";

const EVIDENCE_KINDS = [
  "github_pr","github_ci","vercel_deployment","supabase_migration","benchmark","security",
  "backup_restore","chaos_drill","supply_chain","observability","capacity","incident","screenshot","manual",
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/auth?next=${encodeURIComponent("/admin/control-tower")}`);
    return null;
  }
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.code = data.code;
    throw error;
  }
  return data;
}

function shortHash(value) {
  return typeof value === "string" && value ? `${value.slice(0, 12)}…` : "—";
}

export default function IntegrityBoard() {
  const [releases, setReleases] = useState([]);
  const [releaseId, setReleaseId] = useState("");
  const [integrity, setIntegrity] = useState(null);
  const [ceiling, setCeiling] = useState(null);
  const [resilience, setResilience] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    kind: "github_ci",
    title: "",
    externalRef: "",
    summary: "",
    snapshot: "{}",
  });

  async function loadReleases() {
    const result = await fetchJson("/api/admin/control-tower/releases");
    if (!result) return;
    const next = result.releases || [];
    setReleases(next);
    setReleaseId((current) => current || next.find((item) => item.release_status === "active")?.id || next[0]?.id || "");
  }

  async function refresh(id = releaseId) {
    if (!id) return;
    setError("");
    const query = encodeURIComponent(id);
    const [integrityData, ceilingData, resilienceData, evidenceData] = await Promise.all([
      fetchJson(`/api/admin/control-tower/integrity?releaseId=${query}`),
      fetchJson(`/api/admin/control-tower/technical-ceiling?releaseId=${query}`),
      fetchJson(`/api/admin/control-tower/resilience?releaseId=${query}`),
      fetchJson(`/api/admin/control-tower/evidence?releaseId=${query}`),
    ]);
    setIntegrity(integrityData);
    setCeiling(ceilingData);
    setResilience(resilienceData);
    setEvidence(evidenceData?.evidence || []);
  }

  useEffect(() => { void loadReleases().catch((e) => setError(e.message)); }, []);
  useEffect(() => { void refresh(releaseId).catch((e) => setError(e.message)); }, [releaseId]);

  const technical = ceiling?.technicalCeiling;
  const operational = resilience?.resilience;
  const audit = integrity?.auditIntegrity;
  const drift = integrity?.productionDrift;
  const status = useMemo(() => {
    if (!releaseId) return "NO RELEASE";
    if (audit?.valid === false || drift?.drifted) return "INTEGRITY BLOCKED";
    if (technical?.technicalCeilingEligible) return "TECHNICAL CEILING 100";
    return "HARDENING";
  }, [releaseId, audit, drift, technical]);

  async function registerEvidence(event) {
    event.preventDefault();
    if (!releaseId) return;
    setBusy(true); setError("");
    try {
      let snapshot;
      try {
        snapshot = JSON.parse(evidenceForm.snapshot || "{}");
      } catch {
        throw new Error("Evidence snapshot must be valid JSON.");
      }
      const result = await fetchJson("/api/admin/control-tower/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          kind: evidenceForm.kind,
          title: evidenceForm.title,
          summary: evidenceForm.summary,
          externalRef: evidenceForm.externalRef,
          snapshot,
        }),
      });
      if (result) {
        setEvidenceForm((current) => ({ ...current, title: "", externalRef: "", summary: "", snapshot: "{}" }));
        await refresh(releaseId);
      }
    } catch (e) {
      setError(e.message || "Unable to register evidence.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ctIntegrity" aria-label="Control Tower integrity and evidence">
      <div className="ctIntegrityHead">
        <div><small>INTEGRITY & TECHNICAL CEILING</small><h3>Audit Chain · Drift · Evidence · Resilience</h3></div>
        <div className="ctIntegrityActions">
          <select value={releaseId} onChange={(event) => setReleaseId(event.target.value)} aria-label="Select release for integrity">
            <option value="">Select release</option>
            {releases.map((release) => <option value={release.id} key={release.id}>{release.release_version} · {release.stage}</option>)}
          </select>
          <button type="button" onClick={() => void refresh().catch((e) => setError(e.message))} disabled={!releaseId || busy}>Refresh</button>
        </div>
      </div>

      {error ? <div className="ctIntegrityError" role="alert">{error}</div> : null}

      <div className="ctIntegrityHero">
        <article><span>Control state</span><b>{status}</b></article>
        <article><span>Technical ceiling</span><b>{technical?.overall ?? "—"}</b></article>
        <article><span>Operational resilience</span><b>{operational?.overall ?? "—"}</b></article>
        <article><span>Evidence records</span><b>{evidence.length}</b></article>
      </div>

      <div className="ctIntegrityGrid">
        <article className="ctIntegrityPanel">
          <h4>Audit-chain integrity</h4>
          <dl>
            <div><dt>Valid</dt><dd>{audit ? (audit.valid ? "YES" : "NO") : "—"}</dd></div>
            <div><dt>Events checked</dt><dd>{audit?.checked_count ?? "—"}</dd></div>
            <div><dt>First invalid</dt><dd>{audit?.first_invalid_id || "—"}</dd></div>
            <div><dt>Head hash</dt><dd>{shortHash(audit?.head_hash)}</dd></div>
          </dl>
        </article>

        <article className="ctIntegrityPanel">
          <h4>Production drift</h4>
          <dl>
            <div><dt>Baseline</dt><dd>{drift ? (drift.baselineAvailable ? "YES" : "NO") : "—"}</dd></div>
            <div><dt>Drifted</dt><dd>{drift ? (drift.drifted ? "YES" : "NO") : "—"}</dd></div>
            <div><dt>Mismatches</dt><dd>{drift?.mismatches?.length ?? "—"}</dd></div>
            <div><dt>Runtime SHA</dt><dd>{shortHash(integrity?.live?.runtimeSha)}</dd></div>
          </dl>
          {drift?.mismatches?.length ? <div className="ctMismatchList">{drift.mismatches.slice(0, 8).map((item) => <span key={item.field}>{item.field}</span>)}</div> : null}
        </article>

        <article className="ctIntegrityPanel">
          <h4>Technical-ceiling blockers</h4>
          <div className="ctBlockers">
            {technical?.blockers?.length ? technical.blockers.map((item) => <span key={item}>{item}</span>) : <span>No technical-ceiling blocker reported.</span>}
          </div>
          {releaseId ? <a className="ctSnapshotLink" href={`/api/admin/control-tower/snapshot?releaseId=${encodeURIComponent(releaseId)}&download=1`}>Export deterministic release snapshot</a> : null}
        </article>
      </div>

      <div className="ctEvidenceColumns">
        <article className="ctIntegrityPanel">
          <h4>Register immutable evidence</h4>
          <p className="ctIntegrityHint">Secrets are redacted before storage. Exact duplicate snapshots are rejected by fingerprint.</p>
          <form className="ctEvidenceForm" onSubmit={registerEvidence}>
            <select value={evidenceForm.kind} onChange={(e) => setEvidenceForm({ ...evidenceForm, kind: e.target.value })}>{EVIDENCE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
            <input required placeholder="Evidence title" value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} />
            <input placeholder="External reference / deployment / PR" value={evidenceForm.externalRef} onChange={(e) => setEvidenceForm({ ...evidenceForm, externalRef: e.target.value })} />
            <textarea placeholder="Summary" value={evidenceForm.summary} onChange={(e) => setEvidenceForm({ ...evidenceForm, summary: e.target.value })} />
            <textarea className="ctEvidenceJson" aria-label="Evidence JSON snapshot" value={evidenceForm.snapshot} onChange={(e) => setEvidenceForm({ ...evidenceForm, snapshot: e.target.value })} />
            <button disabled={busy || !releaseId}>{busy ? "Registering…" : "Seal evidence"}</button>
          </form>
        </article>

        <article className="ctIntegrityPanel">
          <h4>Latest evidence</h4>
          <div className="ctEvidenceList">
            {evidence.slice(0, 12).map((item) => <div key={item.id}><span>{item.metadata?.kind || "evidence"}</span><b>{item.title}</b><small>{shortHash(item.metadata?.fingerprint)}</small></div>)}
            {releaseId && !evidence.length ? <p>No evidence registered for this release.</p> : null}
          </div>
        </article>
      </div>

      <style>{`
        .ctIntegrity{margin-top:28px;border:1px solid #ffffff14;background:#081319d9;border-radius:24px;padding:20px}.ctIntegrityHead{display:flex;justify-content:space-between;align-items:end;gap:14px}.ctIntegrityHead small{font-size:10px;font-weight:900;letter-spacing:.16em;color:#91b8c9}.ctIntegrityHead h3{margin:5px 0 0;font-size:24px}.ctIntegrityActions{display:flex;gap:8px;align-items:center}.ctIntegrity select,.ctIntegrity input,.ctIntegrity textarea{box-sizing:border-box;border:1px solid #ffffff18;background:#061015;color:#eef9ff;border-radius:11px;padding:10px 11px;font:inherit}.ctIntegrityActions select{width:min(280px,42vw)}.ctIntegrity button,.ctSnapshotLink{border:0;border-radius:10px;padding:9px 11px;background:#b8deef;color:#071015;font-weight:900;font-size:10px;text-decoration:none}.ctIntegrityHero{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:8px;margin-top:16px}.ctIntegrityHero article,.ctIntegrityPanel{border:1px solid #ffffff10;background:#0a151b;border-radius:16px;padding:14px}.ctIntegrityHero span{display:block;color:#8198a3;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.ctIntegrityHero b{display:block;margin-top:7px;font-size:18px}.ctIntegrityGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.ctIntegrityPanel h4{margin:0 0 10px}.ctIntegrityPanel dl{display:grid;gap:7px;margin:0}.ctIntegrityPanel dl div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #ffffff0b;padding-bottom:6px}.ctIntegrityPanel dt,.ctIntegrityPanel dd{font-size:10px;margin:0}.ctIntegrityPanel dt{color:#8198a3}.ctMismatchList,.ctBlockers{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.ctMismatchList span,.ctBlockers span{border:1px solid #ffffff10;background:#061015;border-radius:999px;padding:6px 8px;font-size:9px;color:#a9bbc4}.ctSnapshotLink{display:inline-block;margin-top:12px}.ctEvidenceColumns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.ctIntegrityHint{font-size:10px;color:#8198a3;line-height:1.5}.ctEvidenceForm{display:grid;gap:8px}.ctEvidenceForm input,.ctEvidenceForm textarea,.ctEvidenceForm select{width:100%}.ctEvidenceForm textarea{min-height:72px;resize:vertical}.ctEvidenceForm .ctEvidenceJson{min-height:125px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}.ctEvidenceList{display:grid;gap:7px}.ctEvidenceList>div{display:grid;grid-template-columns:110px 1fr auto;gap:8px;align-items:center;border:1px solid #ffffff0e;background:#061015;border-radius:10px;padding:9px}.ctEvidenceList span,.ctEvidenceList small{font-size:9px;color:#8198a3}.ctEvidenceList b{font-size:11px}.ctEvidenceList p{font-size:10px;color:#8198a3}.ctIntegrityError{margin-top:12px;padding:10px 12px;border-radius:11px;background:#4b2020;color:#ffd4d0;font-size:11px}@media(max-width:900px){.ctIntegrityHero{grid-template-columns:1fr 1fr}.ctIntegrityGrid,.ctEvidenceColumns{grid-template-columns:1fr}}@media(max-width:560px){.ctIntegrityHead{display:grid;align-items:start}.ctIntegrityActions{display:grid;width:100%}.ctIntegrityActions select{width:100%}.ctIntegrityHero{grid-template-columns:1fr 1fr}.ctEvidenceList>div{grid-template-columns:1fr}.ctIntegrity{padding:16px}}
      `}</style>
    </section>
  );
}
