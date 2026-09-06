"use client";

import { useEffect, useMemo, useState } from "react";

function money(minor, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: String(currency || "USD") }).format(Number(minor || 0) / 100);
  } catch {
    return `${String(currency || "USD")} ${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function BillingHistory() {
  const [state, setState] = useState({ loading: true, orders: [], refunds: [], error: "" });
  const [refundOrderId, setRefundOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const refundByOrder = useMemo(() => new Map(state.refunds.map((item) => [item.order_id, item])), [state.refunds]);

  async function load() {
    try {
      const response = await fetch("/api/commerce/orders", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setState({ loading: false, orders: [], refunds: [], error: "Sign in to view billing history." });
        return;
      }
      if (!response.ok) throw new Error(data?.error || "Billing history is unavailable.");
      setState({ loading: false, orders: data.orders || [], refunds: data.refunds || [], error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error?.message || "Billing history is unavailable." }));
    }
  }

  useEffect(() => { load(); }, []);

  async function submitRefund(event) {
    event.preventDefault();
    if (!refundOrderId || reason.trim().length < 3 || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/commerce/refunds", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: refundOrderId, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to submit refund request.");
      setRefundOrderId("");
      setReason("");
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error?.message || "Unable to submit refund request." }));
    } finally {
      setSubmitting(false);
    }
  }

  return <section style={{ marginTop: 24, padding: 22, borderRadius: 22, background: "#071a14", border: "1px solid #ffffff12" }}>
    <h2 style={{ marginTop: 0 }}>Billing history</h2>
    {state.loading ? <p style={{ color: "#a9bbb3" }}>Loading secure billing records…</p> : null}
    {state.error ? <p role="status" style={{ color: "#e5c767" }}>{state.error}</p> : null}
    {!state.loading && !state.error && state.orders.length === 0 ? <p style={{ color: "#a9bbb3" }}>No LANERIQ AI platform purchases yet.</p> : null}

    <div style={{ display: "grid", gap: 10 }}>
      {state.orders.map((order) => {
        const refund = refundByOrder.get(order.id);
        const canRequest = order.status === "paid" && !refund;
        return <article key={order.id} style={{ padding: 16, borderRadius: 16, border: "1px solid #ffffff12", display: "grid", gap: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{String(order.offer_code || "LANERIQ AI").replaceAll("_", " ").toUpperCase()}</strong>
            <strong>{money(order.expected_amount_minor, order.currency)}</strong>
          </div>
          <small style={{ color: "#9bb0a6" }}>Payment status: {String(order.status || "unknown")} · {when(order.paid_at || order.created_at)}</small>
          {order.reconciliation_required ? <small style={{ color: "#e5c767" }}>Manual payment reconciliation is required. Support should review this order before further financial action.</small> : null}
          {refund ? <small style={{ color: "#9bb0a6" }}>Refund review: {refund.status}{refund.provider_refund_status ? ` · provider ${refund.provider_refund_status}` : ""}</small> : null}
          {canRequest ? <button type="button" onClick={() => setRefundOrderId(order.id)} style={{ justifySelf: "start", borderRadius: 10, padding: "8px 11px", cursor: "pointer" }}>Request refund review</button> : null}
        </article>;
      })}
    </div>

    {refundOrderId ? <form onSubmit={submitRefund} style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 680 }}>
      <strong>Refund review request</strong>
      <p style={{ margin: 0, color: "#a9bbb3", lineHeight: 1.55 }}>Tell us what happened. A request starts a review; it does not guarantee eligibility or an immediate bank refund. Mandatory consumer rights remain unaffected.</p>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} required placeholder="Reason for refund review" style={{ borderRadius: 12, padding: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={submitting || reason.trim().length < 3} style={{ borderRadius: 10, padding: "9px 12px" }}>{submitting ? "Submitting…" : "Submit for review"}</button>
        <button type="button" onClick={() => { setRefundOrderId(""); setReason(""); }} style={{ borderRadius: 10, padding: "9px 12px" }}>Cancel</button>
      </div>
    </form> : null}
  </section>;
}
