"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import LaneriqLotusBrand from "./LaneriqLotusBrand";

const CORE_ROUTES = new Map([
  ["/", "home"],
  ["/login", "login"],
  ["/auth", "auth"],
  ["/create", "create"],
]);

function routeKey(pathname) {
  const path = String(pathname || "/");
  if (path === "/") return "home";
  if (path === "/login" || path.startsWith("/login/")) return "login";
  if (path === "/auth" || path.startsWith("/auth/")) return "auth";
  if (path === "/create" || path.startsWith("/create/")) return "create";
  return "";
}

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
  const current = useMemo(() => routeKey(pathname), [pathname]);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const body = document.body;
    if (!current) {
      delete body.dataset.canonicalCoreUi;
      return undefined;
    }
    body.dataset.canonicalCoreUi = current;
    return () => {
      if (body.dataset.canonicalCoreUi === current) delete body.dataset.canonicalCoreUi;
    };
  }, [current]);

  useEffect(() => {
    if (!current || current === "login" || current === "auth") return undefined;
    let active = true;
    readSession().then((value) => { if (active) setAuthenticated(value); });
    const refresh = () => readSession().then((value) => { if (active) setAuthenticated(value); });
    window.addEventListener("pageshow", refresh);
    return () => {
      active = false;
      window.removeEventListener("pageshow", refresh);
    };
  }, [current]);

  if (!current || !CORE_ROUTES.has(pathname) && !["login", "auth", "create"].includes(current)) return null;

  const showBottomNav = current === "home" || current === "create";
  const accountHref = authenticated ? "/my-apps" : "/login";
  const accountLabel = authenticated ? "Projects" : "Sign in";

  return (
    <>
      <header className="canonicalCoreHeader" data-canonical-ui-owner="true">
        <Link href="/" className="canonicalBrandLink" aria-label="LANERIQ AI home">
          <LaneriqLotusBrand compact />
        </Link>
        <div className="canonicalHeaderStage" aria-hidden="true">
          {current === "login" ? "LOGIN" : current === "auth" ? "EMAIL VERIFICATION" : current === "create" ? "CREATE" : "LIVING INTELLIGENCE"}
        </div>
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
          <Link href="/" aria-current={current === "home" ? "page" : undefined}><span>⌂</span><b>Home</b></Link>
          <Link href="/my-apps"><span>▦</span><b>Projects</b></Link>
          <Link href="/create" aria-current={current === "create" ? "page" : undefined}><span>✦</span><b>Create</b></Link>
          <Link href="/templates"><span>◇</span><b>Templates</b></Link>
          <Link href="/studio"><span>•••</span><b>More</b></Link>
        </nav>
      )}
    </>
  );
}
