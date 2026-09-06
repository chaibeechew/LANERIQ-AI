import Link from "next/link";
import { publicCommercialOffers } from "../../config/commercial-offers.js";
import CheckoutButton from "./CheckoutButton.js";

function dollars(minor) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(minor || 0) / 100);
}

export const metadata = { title: "Billing · LANERIQ AI" };

export default async function BillingPage({ searchParams }) {
  const params = await searchParams;
  const checkout = String(params?.checkout || "").trim();
  const offers = publicCommercialOffers();

  return <main style={{ minHeight: "100vh", background: "#04130f", color: "#f5fff9", padding: "30px 18px 80px" }}>
    <div style={{ width: "min(1050px,100%)", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <Link href="/pricing" style={{ color: "#f5fff9" }}>← Pricing</Link>
        <strong>LANERIQ AI · SECURE BILLING</strong>
      </header>

      <section style={{ padding: "70px 0 28px" }}>
        <small style={{ letterSpacing: ".15em", color: "#e5c767", fontWeight: 900 }}>HOSTED CHECKOUT · SERVER-VERIFIED ACCESS</small>
        <h1 style={{ fontSize: "clamp(42px,8vw,78px)", lineHeight: .95, margin: "12px 0" }}>Choose your creator access.</h1>
        <p style={{ maxWidth: 760, color: "#b8c9c1", lineHeight: 1.7 }}>Prices and entitlement terms are bound on the server. A browser cannot change the charged amount or grant itself paid access. Access is issued only after a signed payment-provider event is verified and persisted.</p>
      </section>

      {checkout === "success" ? <div role="status" style={{ padding: 16, border: "1px solid #65d49b66", borderRadius: 16, marginBottom: 16 }}>Payment received by the hosted checkout. LANERIQ AI is verifying the signed provider event before enabling access. Refresh your account status shortly if access is not visible immediately.</div> : null}
      {checkout === "cancel" ? <div role="status" style={{ padding: 16, border: "1px solid #e5c76755", borderRadius: 16, marginBottom: 16 }}>Checkout was cancelled. No access is granted from a cancelled session.</div> : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        {offers.map((offer) => <article key={offer.code} style={{ border: "1px solid #ffffff18", background: "#071a14", borderRadius: 24, padding: 24 }}>
          <small style={{ color: "#e5c767", fontWeight: 900, letterSpacing: ".12em" }}>{offer.code.replaceAll("_", " ").toUpperCase()}</small>
          <h2 style={{ fontSize: 38, margin: "10px 0" }}>{dollars(offer.amountMinor)}</h2>
          <p style={{ minHeight: 64, color: "#a9bbb3", lineHeight: 1.55 }}>{offer.description}</p>
          <p style={{ fontSize: 12, color: "#80958c" }}>{offer.accessDays ? `${offer.accessDays} days · one payment · no automatic renewal` : "One project credit · one payment"}</p>
          <CheckoutButton offerCode={offer.code} label={`Continue to secure checkout →`} />
        </article>)}
      </section>

      <section style={{ marginTop: 18, padding: 20, borderRadius: 20, background: "#071a14" }}>
        <h2>Commercial boundaries</h2>
        <p style={{ color: "#a9bbb3", lineHeight: 1.65 }}>The launch checkout above covers LANERIQ AI access only. Project-specific Buyout Licenses, enterprise organization billing, creator marketplace settlement, Apple/Google developer fees, taxes, refunds and chargebacks keep their own verified workflows. Apple and Google fees are paid directly to those providers.</p>
      </section>
    </div>
  </main>;
}
