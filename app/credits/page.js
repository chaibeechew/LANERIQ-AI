"use client";

import { useEffect, useState } from "react";
import LaneriqLotusBrand from "../components/LaneriqLotusBrand";

export default function CreditsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/credits", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || "Unable to load credits.");
        return json;
      })
      .then((json) => { if (active) setData(json); })
      .catch((err) => { if (active) setError(err?.message || "Unable to load credits."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const balance = Number(data?.balance ?? 0);
  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];

  return (
    <main className="creditsPage">
      <div className="creditsShell">
        <header className="creditsHero">
          <LaneriqLotusBrand className="creditsBrand" />
          <div className="eyebrow">ACCOUNT · AI USAGE</div>
          <h1>Credits</h1>
          <p className="intro">Your real LANERIQ AI usage balance and server-backed credit activity.</p>
        </header>

        <section className="balanceCard">
          <div className="coinOrb" aria-hidden="true"><span>◎</span></div>
          <div className="balanceCopy">
            <span>AVAILABLE CREDITS</span>
            <strong>{loading ? "—" : balance.toLocaleString()}</strong>
            <small>Balance is loaded from the existing secure credits API.</small>
          </div>
          <div className="balanceState"><i className={error ? "errorDot" : "liveDot"} />{error ? "Unavailable" : loading ? "Loading" : "Current balance"}</div>
        </section>

        {error && <div className="error" role="alert"><b>Credits</b><span>{error}</span></div>}

        <section className="historyCard">
          <div className="historyHeader">
            <div><span className="eyebrow">BILLING / LEDGER</span><h2>Credit History</h2></div>
            <span>{ledger.length} {ledger.length === 1 ? "record" : "records"}</span>
          </div>
          {loading ? (
            <div className="empty"><div className="emptyIcon">◎</div><b>Loading credit activity…</b><small>Reading the current ledger.</small></div>
          ) : ledger.length === 0 ? (
            <div className="empty"><div className="emptyIcon">▤</div><b>No credit activity yet</b><small>Your real purchases and usage history will appear here when records exist.</small></div>
          ) : (
            <div className="ledger">
              {ledger.map((item) => (
                <article className="ledgerRow" key={item.id}>
                  <div className="ledgerMeta"><span className="ledgerIcon" aria-hidden="true">◇</span><div><strong>{item.type || "Activity"}</strong><p>{item.description || "Credit activity"}</p></div></div>
                  <div className={Number(item.amount) >= 0 ? "amount positive" : "amount"}>{Number(item.amount) >= 0 ? "+" : ""}{Number(item.amount).toLocaleString()}</div>
                  <time>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</time>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="truthNote"><span aria-hidden="true">✦</span><p>No sample balance, fake purchase, usage total or promotional credit is inserted by this screen. The API response remains the source of truth.</p></div>
      </div>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .creditsPage{min-height:100svh;padding:118px 22px 126px;background:transparent;color:#f7fbff;font-family:Inter,system-ui,-apple-system,sans-serif}.creditsShell{width:min(920px,100%);margin:auto}.creditsHero{margin-bottom:18px}.creditsBrand{margin-bottom:22px}.eyebrow{letter-spacing:.17em;font-size:10px;color:#f0cc72;font-weight:950}.creditsHero h1{font-size:clamp(42px,7vw,64px);letter-spacing:-.045em;line-height:1;margin:9px 0}.intro{max-width:650px;color:#b9cde0;line-height:1.6;margin:0}.balanceCard{display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;padding:24px;border:1px solid rgba(180,218,255,.24);border-radius:28px;background:linear-gradient(145deg,rgba(13,48,82,.78),rgba(4,22,45,.86));box-shadow:0 30px 92px rgba(0,15,40,.34),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(28px) saturate(140%)}.coinOrb{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(82,181,255,.28);background:radial-gradient(circle at 50% 48%,rgba(242,204,114,.18),rgba(19,80,142,.2) 42%,rgba(3,19,42,.75) 72%);box-shadow:0 0 38px rgba(65,163,255,.22),inset 0 0 28px rgba(82,181,255,.1)}.coinOrb span{font-size:54px;line-height:1;color:#f1cf76;text-shadow:0 0 22px rgba(242,204,114,.55)}.balanceCopy>span,.balanceCopy strong,.balanceCopy small{display:block}.balanceCopy>span{font-size:10px;letter-spacing:.22em;color:#bed7eb;font-weight:900}.balanceCopy strong{font-size:clamp(54px,9vw,82px);line-height:.95;margin:10px 0 8px;color:#fff}.balanceCopy small{color:#8fa8bd;font-size:10px}.balanceState{display:flex;align-items:center;gap:7px;align-self:start;padding:8px 11px;border-radius:999px;border:1px solid rgba(181,218,249,.14);background:rgba(4,22,45,.55);color:#b4caDD;font-size:9px;font-weight:850}.liveDot,.errorDot{width:7px;height:7px;border-radius:50%;background:#66df91;box-shadow:0 0 13px rgba(102,223,145,.7)}.errorDot{background:#ff8c83;box-shadow:0 0 13px rgba(255,140,131,.65)}.historyCard{margin-top:13px;padding:22px;border:1px solid rgba(180,218,255,.2);border-radius:25px;background:linear-gradient(145deg,rgba(10,39,70,.74),rgba(4,20,42,.82));box-shadow:0 24px 72px rgba(0,15,40,.27);backdrop-filter:blur(24px)}.historyHeader{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding:0 2px 15px}.historyHeader h2{font-size:25px;margin:5px 0 0}.historyHeader>span{font-size:9px;color:#8ea6bb;padding:7px 9px;border:1px solid rgba(180,218,255,.11);border-radius:999px}.ledger{display:grid}.ledgerRow{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:center;padding:15px 3px;border-top:1px solid rgba(180,218,255,.09)}.ledgerMeta{display:flex;align-items:center;gap:10px}.ledgerIcon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(64,156,242,.09);border:1px solid rgba(99,185,255,.16);color:#9bd5ff}.ledgerRow p{margin:4px 0 0;color:#8fa7bb;font-size:11px}.ledgerRow strong{font-size:12px}.amount{font-weight:950;color:#e6edf4}.positive{color:#9ce7b8}.ledgerRow time{font-size:9px;color:#71899d;min-width:145px;text-align:right}.empty{min-height:290px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;border:1px dashed rgba(133,197,249,.18);border-radius:20px;background:rgba(3,18,38,.35);color:#8299ad}.emptyIcon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(95,183,255,.18);background:rgba(43,137,224,.08);color:#a9d9ff;font-size:24px}.empty b{color:#d9e8f4;font-size:14px}.empty small{max-width:430px;font-size:10px;line-height:1.55}.error{margin-top:13px;display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px solid rgba(255,112,101,.22);border-radius:14px;background:rgba(130,40,50,.23);color:#ffc6c1;font-size:11px}.error b{color:#ffaaa3}.truthNote{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(242,204,114,.11);background:rgba(242,204,114,.04)}.truthNote>span{color:#f0cc72}.truthNote p{margin:0;color:#8098ac;font-size:9px;line-height:1.55}@media(max-width:1000px){.creditsPage{padding-top:88px}}@media(max-width:650px){.creditsPage{padding:84px 10px 116px}.balanceCard{grid-template-columns:auto 1fr;padding:18px;border-radius:22px}.coinOrb{width:78px;height:78px}.coinOrb span{font-size:40px}.balanceState{grid-column:1/-1;justify-self:start}.historyCard{padding:16px;border-radius:21px}.ledgerRow{grid-template-columns:1fr auto}.ledgerRow time{grid-column:1/-1;text-align:left;min-width:0}.historyHeader{align-items:flex-start;flex-direction:column}}
`;
