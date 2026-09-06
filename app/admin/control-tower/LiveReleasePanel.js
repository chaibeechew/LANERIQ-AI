"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function stateLabel(state) {
  if (state === "pass") return "PASS";
  if (state === "fail") return "BLOCKED";
  return "PENDING";
}

function truthLabel(state) {
  if (state === "verified") return "PRODUCTION VERIFIED";
  if (state === "blocked") return "RELEASE BLOCKED";
  return "VERIFICATION PENDING";
}

export default function LiveReleasePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/control-tower/status", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load release status.");
      setData(payload);
    } catch (err) {
      setError(err?.message || "Unable to load release status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const headline = useMemo(() => {
    if (!data) return "Live release truth";
    return truthLabel(data.releaseTruth?.state);
  }, [data]);

  return (
    <section className="liveRelease" aria-live="polite">
      <div className="liveHead">
        <div>
          <div className="eyebrow">LIVE RELEASE TRUTH</div>
          <h3>{headline}</h3>
          <p>GitHub main, runtime build identity, CI state and production environment are evaluated without exposing secrets.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="liveError" role="alert">{error}</div> : null}

      {data ? (
        <>
          <div className="truthGrid">
            <div className="truthMetric">
              <small>Repository</small>
              <strong>{data.repository}</strong>
            </div>
            <div className="truthMetric">
              <small>GitHub main</small>
              <strong>{data.github?.mainShaShort || "Unavailable"}</strong>
            </div>
            <div className="truthMetric">
              <small>Runtime SHA</small>
              <strong>{data.runtime?.commitShaShort || "Unavailable"}</strong>
            </div>
            <div className="truthMetric">
              <small>Environment</small>
              <strong>{data.runtime?.environment || "Unknown"}</strong>
            </div>
          </div>

          <div className="gateGrid">
            {(data.releaseTruth?.gates || []).map((gate) => (
              <article className="gate" data-state={gate.state} key={gate.id}>
                <div className="gateTop">
                  <span>{gate.label}</span>
                  <b>{stateLabel(gate.state)}</b>
                </div>
                <p>{gate.detail}</p>
              </article>
            ))}
          </div>

          <div className="truthFooter">
            <span>
              Exact SHA: <strong>{data.releaseTruth?.exactSha ? "MATCH" : "NOT VERIFIED"}</strong>
            </span>
            <span>
              Checked: {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
            </span>
          </div>
        </>
      ) : loading ? <div className="liveSkeleton">Loading release evidence…</div> : null}

      <style>{`
        .liveRelease{margin-top:18px;border:1px solid #ffffff18;background:linear-gradient(145deg,#0b171ddd,#071015ee);border-radius:24px;padding:22px}.liveHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.liveHead h3{margin:5px 0 8px;font-size:26px;letter-spacing:-.035em}.liveHead p{margin:0;max-width:760px;color:#91a7b2;line-height:1.55;font-size:12px}.liveHead button{border:1px solid #ffffff1a;background:#f5fbff;color:#071116;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer}.liveHead button:disabled{opacity:.55;cursor:wait}.truthGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:18px}.truthMetric{border:1px solid #ffffff12;background:#071116;border-radius:15px;padding:13px;min-width:0}.truthMetric small{display:block;color:#78909b;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:850}.truthMetric strong{display:block;margin-top:6px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gateGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:9px}.gate{border:1px solid #ffffff12;background:#091419;border-radius:15px;padding:13px}.gateTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.gateTop span{font-size:11px;font-weight:800}.gateTop b{font-size:8px;letter-spacing:.08em;border-radius:999px;padding:5px 7px;background:#ffffff0d;color:#adc0c9}.gate[data-state="pass"]{border-color:#5be1a036}.gate[data-state="pass"] .gateTop b{color:#7ce7b4;background:#123524}.gate[data-state="fail"]{border-color:#ff7e733e}.gate[data-state="fail"] .gateTop b{color:#ff9e95;background:#3b1718}.gate p{margin:8px 0 0;color:#7f96a1;font-size:10px;line-height:1.45}.truthFooter{display:flex;justify-content:space-between;gap:16px;margin-top:12px;color:#7e939d;font-size:10px}.truthFooter strong{color:#dcebf2}.liveError{margin-top:14px;border:1px solid #ff81733a;background:#361819;color:#ffc2bc;border-radius:12px;padding:11px;font-size:11px}.liveSkeleton{margin-top:16px;color:#8ba0aa;font-size:11px}@media(max-width:820px){.truthGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.gateGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.liveRelease{padding:17px}.liveHead{display:grid}.liveHead button{width:100%}.truthGrid,.gateGrid{grid-template-columns:1fr}.truthFooter{display:grid;gap:5px}}
      `}</style>
    </section>
  );
}
