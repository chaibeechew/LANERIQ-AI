"use client";

import { useState } from "react";

export default function CheckoutButton({ offerCode, label }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const requestId = globalThis.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await fetch("/api/commerce/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
        body: JSON.stringify({ offerCode, requestId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/auth?next=${encodeURIComponent("/billing")}`);
        return;
      }
      if (!response.ok || !data?.url) throw new Error(data?.error || "Unable to start checkout.");
      window.location.assign(data.url);
    } catch (caught) {
      setError(caught?.message || "Unable to start checkout.");
      setBusy(false);
    }
  }

  return <div style={{ display: "grid", gap: 8 }}>
    <button type="button" onClick={startCheckout} disabled={busy} style={{ border: 0, borderRadius: 13, padding: "13px 16px", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
      {busy ? "Opening secure checkout…" : label}
    </button>
    {error ? <small role="alert" style={{ color: "#ffb4b4", lineHeight: 1.4 }}>{error}</small> : null}
  </div>;
}
