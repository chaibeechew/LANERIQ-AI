"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LaneriqLotusBrand from "../../components/LaneriqLotusBrand";

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [phase, setPhase] = useState("ready");
  const [requestId, setRequestId] = useState("");
  const [flowToken, setFlowToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const phaseTitle = useMemo(() => {
    if (phase === "verify_current") return "Verify your current email";
    if (phase === "verify_new") return "Verify your new email";
    if (phase === "complete") return "Email changed";
    return "Account & Security";
  }, [phase]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/account/email-change", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!mounted) return;
        if (response.status === 401) {
          router.replace("/auth?next=%2Faccount%2Fsecurity");
          return;
        }
        if (!response.ok || data?.success !== true) throw new Error(data?.error || "Account security is unavailable.");
        setCurrentEmail(String(data.email || ""));
      } catch (err) {
        if (mounted) setError(err?.message || "Account security is unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  async function submit(action, nextRequestId = requestId) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = { action, newEmail, requestId: nextRequestId };
      if (action !== "request") {
        payload.code = code;
        payload.flowToken = flowToken;
      }
      const response = await fetch("/api/account/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) throw new Error(data?.error || "Email verification could not be completed.");

      if (action === "request") {
        setRequestId(nextRequestId);
        setFlowToken(String(data.flowToken || ""));
        setCode("");
        setPhase("verify_current");
      } else if (action === "verify_current") {
        setFlowToken(String(data.flowToken || ""));
        setCode("");
        setPhase("verify_new");
      } else {
        setCurrentEmail(String(data.email || newEmail));
        setNewEmail("");
        setFlowToken("");
        setCode("");
        setRequestId("");
        setPhase("complete");
      }
      setMessage(String(data.message || "Verification completed."));
    } catch (err) {
      setError(err?.message || "Email verification could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function startChange() {
    const id = newRequestId();
    void submit("request", id);
  }

  function startOver() {
    setPhase("ready");
    setRequestId("");
    setFlowToken("");
    setCode("");
    setMessage("");
    setError("");
  }

  if (loading) return <main className="securityPage"><section className="securityCard loadingCard"><LaneriqLotusBrand compact /><p>Loading account security…</p></section><style jsx>{styles}</style></main>;

  return <main className="securityPage">
    <section className="securityShell">
      <header className="securityHero">
        <LaneriqLotusBrand className="securityBrand" />
        <button className="back" onClick={() => router.push("/my-apps")}>← My Projects</button>
        <div className="eyebrow">ACCOUNT · SECURITY · EMAIL</div>
        <h1>{phaseTitle}</h1>
        <p className="lead">Manage your verified email with LANERIQ AI’s existing two-step Email Code flow. No SMS fallback is introduced.</p>
      </header>

      <div className="trustRow" aria-label="Security principles">
        <article><span>01</span><div><b>Current email first</b><small>Prove access to the verified address.</small></div></article>
        <article><span>02</span><div><b>New email second</b><small>Confirm the destination independently.</small></div></article>
        <article><span>✓</span><div><b>Change only after both</b><small>The account updates only after both checks pass.</small></div></article>
      </div>

      <section className="securityCard">
        <div className="cardHeading">
          <div><span className="eyebrow">VERIFIED IDENTITY</span><h2>Secure email change</h2></div>
          <span className={`phaseBadge phase-${phase}`}>{phase === "ready" ? "Ready" : phase === "complete" ? "Complete" : "Verification in progress"}</span>
        </div>

        <div className="identityBox">
          <span className="identityIcon" aria-hidden="true">✉</span>
          <div><span>Current verified email</span><strong>{currentEmail || "Unavailable"}</strong></div>
        </div>

        {(phase === "ready" || phase === "complete") && <div className="stack">
          <label htmlFor="newEmail">New email address</label>
          <input id="newEmail" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} disabled={busy} />
          <button className="primary" onClick={startChange} disabled={busy || !newEmail.trim()}>{busy ? "Sending code…" : "Send code to current email"}<span aria-hidden="true">→</span></button>
        </div>}

        {(phase === "verify_current" || phase === "verify_new") && <div className="stack verificationStack">
          <div className="stepPill">{phase === "verify_current" ? "STEP 1 OF 2 · CURRENT EMAIL" : "STEP 2 OF 2 · NEW EMAIL"}</div>
          <label htmlFor="verificationCode">8-digit Email Code</label>
          <input id="verificationCode" className="codeInput" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} placeholder="••••••••" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} disabled={busy} />
          <div className="verificationActions">
            <button className="primary" onClick={() => void submit(phase === "verify_current" ? "verify_current" : "verify_new")} disabled={busy || code.length !== 8}>{busy ? "Verifying…" : phase === "verify_current" ? "Verify current email" : "Verify new email & change"}<span aria-hidden="true">→</span></button>
            <button className="secondary" onClick={startOver} disabled={busy}>Start over / resend</button>
          </div>
        </div>}

        {message && <div className="success" role="status">{message}</div>}
        {error && <div className="error" role="alert">{error}</div>}

        <div className="securityNote"><span aria-hidden="true">◇</span><p><b>LANERIQ Email Code only.</b> This redesign changes presentation only; the existing account-security API, request IDs, flow tokens and two-code sequence remain authoritative.</p></div>
      </section>
    </section>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
  .securityPage{min-height:100svh;padding:118px 22px 126px;background:transparent;color:#f7fbff;font-family:Inter,system-ui,-apple-system,sans-serif}.securityShell{width:min(920px,100%);margin:0 auto}.securityHero{position:relative;padding:4px 2px 22px}.securityBrand{margin-bottom:24px}.back{position:absolute;right:0;top:8px;min-height:42px;border:1px solid rgba(180,218,255,.2);border-radius:14px;padding:0 14px;background:rgba(5,24,48,.58);color:#dbeeff;font-weight:850;cursor:pointer;backdrop-filter:blur(18px)}.eyebrow{font-size:10px;font-weight:950;letter-spacing:.17em;color:#f0cc72}.securityHero h1{font-size:clamp(38px,7vw,64px);line-height:1;margin:9px 0 11px;letter-spacing:-.045em}.lead{max-width:720px;color:#bfd1e2;line-height:1.65;margin:0;font-size:14px}.trustRow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:13px}.trustRow article{min-height:86px;display:flex;align-items:center;gap:11px;padding:14px;border:1px solid rgba(178,218,255,.18);border-radius:18px;background:linear-gradient(145deg,rgba(16,48,82,.7),rgba(5,24,48,.68));box-shadow:0 20px 60px rgba(0,15,40,.25);backdrop-filter:blur(22px)}.trustRow article>span{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:grid;place-items:center;border:1px solid rgba(120,190,255,.28);background:linear-gradient(145deg,rgba(34,126,235,.26),rgba(21,70,139,.15));color:#a9d9ff;font-weight:950}.trustRow b,.trustRow small{display:block}.trustRow b{font-size:12px}.trustRow small{margin-top:4px;color:#90a8bd;font-size:10px;line-height:1.4}.securityCard{padding:25px;border:1px solid rgba(180,218,255,.24);border-radius:28px;background:linear-gradient(145deg,rgba(13,48,82,.78),rgba(4,22,45,.86));box-shadow:0 32px 100px rgba(0,15,40,.36),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(28px) saturate(140%)}.loadingCard{margin:14vh auto 0;width:min(560px,calc(100% - 28px));display:flex;align-items:center;gap:16px}.loadingCard p{color:#b9cde0}.cardHeading{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin-bottom:18px}.cardHeading h2{font-size:26px;margin:5px 0 0}.phaseBadge{padding:8px 11px;border-radius:999px;border:1px solid rgba(158,204,244,.2);background:rgba(6,27,54,.6);color:#b9d9f3;font-size:9px;font-weight:900;letter-spacing:.06em}.phase-complete{color:#aef0c9;border-color:rgba(102,223,145,.24)}.identityBox{display:flex;gap:13px;align-items:center;padding:15px 16px;border:1px solid rgba(185,220,252,.14);border-radius:17px;background:rgba(3,19,41,.54);margin-bottom:18px}.identityIcon{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;border-radius:13px;border:1px solid rgba(89,183,255,.28);background:rgba(37,124,214,.12);color:#93d5ff;font-size:19px}.identityBox div>span,.identityBox strong{display:block}.identityBox div>span{font-size:10px;color:#8ea7bc;font-weight:800}.identityBox strong{margin-top:4px;font-size:14px;overflow-wrap:anywhere}.stack{display:grid;gap:10px}.stack label{font-size:11px;font-weight:900;color:#e7d193}.stack input{width:100%;box-sizing:border-box;min-height:56px;border:1px solid rgba(154,207,251,.23);border-radius:16px;background:linear-gradient(180deg,rgba(250,253,255,.97),rgba(226,239,249,.95));color:#152333;padding:0 16px;font-size:16px;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.78)}.stack input:focus{border-color:#74c7ff;box-shadow:0 0 0 3px rgba(77,181,255,.12),0 0 30px rgba(65,162,255,.14)}.codeInput{text-align:center;letter-spacing:.32em;font-size:24px!important;font-weight:1000}.primary,.secondary{min-height:52px;border-radius:15px;font-weight:950;cursor:pointer;font:inherit}.primary{display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid rgba(255,233,168,.78);background:linear-gradient(135deg,#f8dc86,#eab950);color:#172131;box-shadow:0 12px 32px rgba(221,174,65,.19)}.primary span{font-size:18px}.secondary{border:1px solid rgba(176,214,248,.18);background:rgba(4,22,45,.58);color:#d8e9f7}.primary:disabled,.secondary:disabled{opacity:.48;cursor:not-allowed}.verificationActions{display:grid;grid-template-columns:1fr auto;gap:9px}.stepPill{justify-self:start;padding:8px 11px;border-radius:999px;background:rgba(75,160,245,.1);border:1px solid rgba(105,189,255,.18);color:#a8d8ff;font-size:9px;font-weight:950;letter-spacing:.1em}.success,.error{margin-top:14px;padding:12px 14px;border-radius:13px;font-size:12px;font-weight:800;line-height:1.5}.success{background:rgba(55,170,115,.13);border:1px solid rgba(74,215,148,.24);color:#aaf0c8}.error{background:rgba(210,68,58,.13);border:1px solid rgba(255,105,95,.25);color:#ffc1bb}.securityNote{display:flex;gap:12px;align-items:flex-start;margin-top:18px;padding:13px 14px;border:1px solid rgba(242,204,114,.13);border-radius:15px;background:rgba(242,204,114,.045)}.securityNote>span{color:#f1ce75}.securityNote p{margin:0;color:#91a8bc;font-size:10px;line-height:1.55}.securityNote b{color:#e9d69c}@media(max-width:1000px){.securityPage{padding-top:88px}}@media(max-width:680px){.securityPage{padding:84px 10px 116px}.securityHero{padding-top:56px}.securityBrand{margin-bottom:18px}.back{left:0;right:auto;top:0}.trustRow{grid-template-columns:1fr}.securityCard{padding:18px;border-radius:22px}.cardHeading{align-items:flex-start;flex-direction:column}.verificationActions{grid-template-columns:1fr}.primary,.secondary,.stack input{min-height:54px}}
`;
