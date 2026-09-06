"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LaneriqLotusBrand from "./LaneriqLotusBrand";
import { CANONICAL_PRIMARY_NAV, resolveCanonicalUiContext } from "../../lib/product/canonical-ui-registry.js";

const CORE_IDS = new Set(["home", "login", "auth", "create", "build-progress"]);

async function readSession() {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await response.json().catch(() => ({}));
    return Boolean(response.ok && data?.authenticated === true && data?.sessionAuthority === "laneriq");
  } catch {
    return false;
  }
}

export default function CanonicalCoreUIOwner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const context = useMemo(() => resolveCanonicalUiContext(pathname, searchParams), [pathname, searchParams]);
  const current = context?.id || "";
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const body = document.body;
    if (!CORE_IDS.has(current)) {
      delete body.dataset.canonicalCoreUi;
      return undefined;
    }
    const dataValue = current === "build-progress" ? "create" : current;
    body.dataset.canonicalCoreUi = dataValue;
    body.dataset.canonicalUiVersion = "2026.09-canonical-ui-v1";
    return () => {
      if (body.dataset.canonicalCoreUi === dataValue) delete body.dataset.canonicalCoreUi;
    };
  }, [current]);

  useEffect(() => {
    if (!CORE_IDS.has(current) || current === "login" || current === "auth") return undefined;
    let active = true;
    readSession().then((value) => { if (active) setAuthenticated(value); });
    const refresh = () => readSession().then((value) => { if (active) setAuthenticated(value); });
    window.addEventListener("pageshow", refresh);
    return () => {
      active = false;
      window.removeEventListener("pageshow", refresh);
    };
  }, [current]);

  if (!CORE_IDS.has(current)) return null;

  const showBottomNav = current === "home" || current === "create" || current === "build-progress";
  const accountHref = authenticated ? "/my-apps" : "/login";
  const accountLabel = authenticated ? "Projects" : "Sign in";
  const stageLabel = current === "auth" ? "EMAIL VERIFICATION" : context?.stage?.toUpperCase?.() || "LIVING INTELLIGENCE";

  return (
    <>
      <header className="canonicalCoreHeader" data-canonical-ui-owner="true">
        <Link href="/" className="canonicalBrandLink" aria-label="LANERIQ AI home">
          <LaneriqLotusBrand compact />
        </Link>
        <div className="canonicalHeaderStage" aria-hidden="true">{stageLabel}</div>
        <nav className="canonicalHeaderActions" aria-label="Core account actions">
          {(current === "login" || current === "auth") ? (
            <Link href="/">Home</Link>
          ) : (
            <Link href={accountHref}>{accountLabel}</Link>
          )}
        </nav>
      </header>

      {showBottomNav && (
        <nav className="canonicalBottomNav" aria-label="LANERIQ primary navigation">
          {CANONICAL_PRIMARY_NAV.map((item) => {
            const active = context?.nav === item.label || (item.id === "home" && current === "home") || (item.id === "create" && (current === "create" || current === "build-progress"));
            return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined}><span>{item.icon}</span><b>{item.label}</b></Link>;
          })}
        </nav>
      )}
    </>
  );
}
