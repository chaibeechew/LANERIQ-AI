"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <div className="canonicalBackdrop" aria-hidden="true" />
      <section className="loginCard" aria-labelledby="login-title">
        <div className="loginEyebrow">SECURE SIGN IN</div>
        <h1 id="login-title">Welcome back.</h1>
        <p>Continue with your email. LANERIQ AI uses a one-time verification code, so there is no password to remember.</p>
        <Link className="loginPrimary" href="/auth?next=%2Fcreate">
          <span>Continue with Email</span><span aria-hidden="true">→</span>
        </Link>
        <Link className="loginSecondary" href="/">Back to Home</Link>
        <p className="loginTrust">Email → verification code → Create. SMS is not used as a customer fallback.</p>
      </section>
    </main>
  );
}
