"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LaneriqLotusBrand from "../components/LaneriqLotusBrand";
import styles from "./domains.module.css";

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function formatMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

export default function DomainsPage() {
  const [domainName, setDomainName] = useState("laneriqai.com");
  const [checked, setChecked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState("");
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState(null);

  const normalized = useMemo(() => String(domainName || "").trim().toLowerCase().replace(/\.$/, ""), [domainName]);
  const requiredAcknowledgement = normalized ? `REGISTER ${normalized}` : "";
  const canRegister = Boolean(checked?.registrable && checked?.pricing?.registration_cost && checked?.pricing?.currency && acknowledgement === requiredAcknowledgement && !registering);

  async function checkDomain(event) {
    event?.preventDefault?.();
    setChecking(true);
    setError("");
    setMessage("");
    setRegistration(null);
    setChecked(null);
    setAcknowledgement("");
    try {
      const response = await fetch("/api/domains/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainName: normalized }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || "Unable to check this domain.");
      const result = Array.isArray(data?.domains) ? data.domains[0] : null;
      if (!result) throw new Error("No registrar result was returned.");
      setChecked(result);
      if (result.registrable) setMessage("Live registry check complete. Review the price before registering.");
      else setMessage(result.reason === "domain_unavailable" ? "This domain is already registered." : `This domain cannot be registered here${result.reason ? `: ${result.reason}` : "."}`);
    } catch (err) {
      setError(String(err?.message || "Unable to check this domain."));
    } finally {
      setChecking(false);
    }
  }

  async function register() {
    if (!canRegister) return;
    setRegistering(true);
    setError("");
    setMessage("Re-checking the registry and price before any billable action…");
    try {
      const response = await fetch("/api/domains/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: normalized,
          expectedRegistrationCost: String(checked.pricing.registration_cost),
          expectedCurrency: checked.pricing.currency,
          acknowledgement,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || "Registration did not start.");
      setRegistration(data.registration || null);
      const state = data?.registration?.state || "submitted";
      setMessage(state === "succeeded" ? `${normalized} is registered.` : `Registration submitted safely. Current state: ${state}.`);
    } catch (err) {
      setError(String(err?.message || "Registration did not start."));
      setMessage("");
    } finally {
      setRegistering(false);
    }
  }

  async function refreshStatus() {
    if (!normalized) return;
    setError("");
    try {
      const response = await fetch(`/api/domains/status?domain=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || "Unable to refresh registration status.");
      setRegistration(data.registration || null);
      setMessage(`Registration state: ${data?.registration?.state || "unknown"}.`);
    } catch (err) {
      setError(String(err?.message || "Unable to refresh registration status."));
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href="/" className={styles.brandLink}><LaneriqLotusBrand compact /></Link>
          <span className={styles.badge}>DOMAIN REGISTRAR · LIVE CHECK</span>
        </header>

        <div className={styles.hero}>
          <p className={styles.kicker}>OWN YOUR BRAND</p>
          <h1>Find and register your domain.</h1>
          <p>Live availability and pricing are checked again immediately before registration, so a changed price cannot be silently accepted.</p>
        </div>

        <div className={styles.trustStrip}>
          <div><b>01</b><span>Live availability</span></div>
          <div><b>02</b><span>Live pricing</span></div>
          <div><b>03</b><span>Typed confirmation</span></div>
          <div><b>04</b><span>Server re-check before billing</span></div>
        </div>

        <form className={styles.searchCard} onSubmit={checkDomain}>
          <label htmlFor="domain-name">Domain name</label>
          <div className={styles.searchRow}>
            <input id="domain-name" value={domainName} onChange={(event) => setDomainName(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="laneriqai.com" />
            <button type="submit" disabled={checking || !normalized}>{checking ? "Checking…" : "Check live price"}</button>
          </div>
          <small>ASCII domains only in the current registrar beta.</small>
        </form>

        {checked && (
          <section className={styles.resultCard}>
            <div className={styles.domainLine}>
              <div>
                <span className={styles.muted}>DOMAIN</span>
                <strong>{checked.name}</strong>
              </div>
              <span className={checked.registrable ? styles.available : styles.unavailable}>{checked.registrable ? "Available" : "Unavailable"}</span>
            </div>

            {checked.registrable && checked.pricing && (
              <>
                <div className={styles.priceGrid}>
                  <div><span>First year</span><strong>{formatMoney(checked.pricing.registration_cost, checked.pricing.currency)}</strong></div>
                  <div><span>Renewal</span><strong>{formatMoney(checked.pricing.renewal_cost, checked.pricing.currency)}</strong></div>
                  <div><span>Tier</span><strong>{checked.tier || "standard"}</strong></div>
                </div>

                <div className={styles.safetyBox}>
                  <b>Purchase safety</b>
                  <p>The server checks the registry price one more time. If it changed, exceeds the configured safety cap, or the domain becomes unavailable, registration stops.</p>
                </div>

                <label className={styles.confirmLabel} htmlFor="domain-confirmation">Type <code>{requiredAcknowledgement}</code> to unlock the billable registration button.</label>
                <input id="domain-confirmation" className={styles.confirmInput} value={acknowledgement} onChange={(event) => setAcknowledgement(event.target.value)} placeholder={requiredAcknowledgement} autoCapitalize="none" autoCorrect="off" spellCheck={false} />

                <button className={styles.buyButton} type="button" disabled={!canRegister} onClick={register}>
                  {registering ? "Registering…" : `Register ${checked.name}`}
                </button>
                <p className={styles.disclaimer}>Registration is non-refundable once completed. Purchasing remains disabled by default until the server billing switch is explicitly enabled.</p>
              </>
            )}
          </section>
        )}

        {(message || error) && <div className={error ? styles.error : styles.message}>{error || message}</div>}

        {registration && (
          <section className={styles.statusCard}>
            <div><span>Status</span><strong>{registration.state || registration?.context?.registration?.status || "unknown"}</strong></div>
            <button type="button" onClick={refreshStatus}>Refresh status</button>
          </section>
        )}

        <div className={styles.truthNote}>LANERIQ AI does not invent availability or pricing on this screen. Registry and server responses remain authoritative.</div>
      </section>
    </main>
  );
}
