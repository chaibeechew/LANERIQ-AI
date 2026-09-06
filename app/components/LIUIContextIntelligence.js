"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { I18N_STORAGE_KEY, normalizeLanguage, translateUiText } from "../../lib/i18n/catalog.js";
import { CANONICAL_CREATION_JOURNEY, canonicalCreationIndex, resolveCanonicalUiContext } from "../../lib/product/canonical-ui-registry.js";
import { liuiContextText } from "../../lib/i18n/liui-context-translations.js";

function evidenceKey(value) {
  const normalized = String(value || "code").toLowerCase();
  if (normalized.includes("store") || normalized.includes("external")) return "External publication evidence";
  if (normalized.includes("production") || normalized.includes("release")) return "Release evidence";
  if (normalized.includes("runtime") || normalized.includes("browser") || normalized.includes("live")) return "Live runtime evidence";
  return "Code evidence";
}

function riskKey(value) {
  const normalized = String(value || "low").toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function annotateExistingStates() {
  const annotate = (selector, role, live, busy = false) => {
    for (const node of document.querySelectorAll(selector)) {
      if (!node.hasAttribute("role")) node.setAttribute("role", role);
      if (!node.hasAttribute("aria-live")) node.setAttribute("aria-live", live);
      if (busy && !node.hasAttribute("aria-busy")) node.setAttribute("aria-busy", "true");
    }
  };
  annotate(".error,.errorBox,[data-state='error']", "alert", "assertive");
  annotate(".success,.successBox,.notice,[data-state='success']", "status", "polite");
  annotate(".loading,.loadingState,[data-state='loading']", "status", "polite", true);
  annotate(".emptyState,[data-state='empty']", "status", "polite");
}

function publishContextState(present, open, routeId) {
  const body = document.body;
  if (present) {
    body.dataset.liuiContextPresent = "true";
    body.dataset.liuiDecisionOpen = open ? "true" : "false";
  } else {
    delete body.dataset.liuiContextPresent;
    delete body.dataset.liuiDecisionOpen;
  }
  window.dispatchEvent(new CustomEvent("laneriq:context-intelligence-state", {
    detail: { present: Boolean(present), open: Boolean(open), routeId: String(routeId || "") },
  }));
}

export default function LIUIContextIntelligence() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useMemo(() => resolveCanonicalUiContext(pathname, searchParams), [pathname, searchParams]);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const currentLanguage = () => {
      try {
        return normalizeLanguage(window.__LANERIQ_LANGUAGE__ || localStorage.getItem(I18N_STORAGE_KEY) || navigator.language || "en");
      } catch {
        return "en";
      }
    };
    setLanguage(currentLanguage());
    const handleLanguage = (event) => setLanguage(normalizeLanguage(event?.detail?.language || currentLanguage()));
    window.addEventListener("laneriq-language-change", handleLanguage);
    return () => window.removeEventListener("laneriq-language-change", handleLanguage);
  }, []);

  useEffect(() => {
    const present = Boolean(context);
    publishContextState(present, false, context?.id);
    return () => publishContextState(false, false, "");
  }, [context?.id]);

  useEffect(() => {
    if (!context) return undefined;
    const body = document.body;
    body.dataset.liuiContextRoute = context.id;
    body.dataset.liuiContextGroup = context.group || "workspace";
    body.dataset.liuiContextRisk = String(context.risk || "low").toLowerCase();
    body.dataset.liuiContextApproval = context.approval ? "required" : "bounded";
    body.dataset.liuiContextEvidence = String(context.evidence || "code");

    const annotationRoot = document.querySelector("main") || body;
    let frame = 0;
    const scheduleAnnotation = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(annotateExistingStates);
    };
    scheduleAnnotation();
    const observer = new MutationObserver(scheduleAnnotation);
    observer.observe(annotationRoot, { subtree: true, childList: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      delete body.dataset.liuiContextRoute;
      delete body.dataset.liuiContextGroup;
      delete body.dataset.liuiContextRisk;
      delete body.dataset.liuiContextApproval;
      delete body.dataset.liuiContextEvidence;
    };
  }, [context]);

  if (!context) return null;

  const t = (key) => liuiContextText(key, language);
  const canonical = (text) => translateUiText(String(text || ""), language);
  const journeyIndex = canonicalCreationIndex(context.stage);
  const risk = t(riskKey(context.risk));
  const evidence = t(evidenceKey(context.evidence));

  return (
    <aside
      className={`liuiContextIntelligence route-${context.id}`}
      data-liui-context-intelligence="true"
      data-route-id={context.id}
      data-page-group={context.group}
      data-risk={String(context.risk || "low").toLowerCase()}
      data-approval={context.approval ? "required" : "bounded"}
      aria-label={t("Page intelligence")}
    >
      <details
        key={context.id}
        className="liuiContextDetails"
        onToggle={(event) => publishContextState(true, event.currentTarget.open === true, context.id)}
      >
        <summary aria-label={t("Open page intelligence")}>
          <span className="liuiContextMark" aria-hidden="true">✦</span>
          <strong>{canonical(context.name)}</strong>
          <span className="liuiContextGroup">{canonical(context.stage)}</span>
          <span className="liuiContextRisk">{t("Risk")}: {risk}</span>
        </summary>
        <div className="liuiContextPanel">
          <div className="liuiContextBento" aria-label={t("Current stage")}>
            <section><small>{t("Current stage")}</small><b>{canonical(context.stage)}</b></section>
            <section><small>{t("Evidence")}</small><b>{evidence}</b></section>
            <section><small>{t("Approval")}</small><b>{context.approval ? t("Approval required") : t("No separate approval required")}</b></section>
          </div>

          <section className="liuiContextNext" aria-label={t("Next best action")}>
            <small>{t("Next best action")}</small>
            <h3>{canonical(context.primaryAction)}</h3>
            <p>{context.approval ? t("Human approval required before consequential actions.") : t("AI may assist within current permissions.")}</p>
          </section>

          {journeyIndex >= 0 && (
            <section className="liuiContextJourney" aria-label={t("Creation journey")}>
              <small>{t("Creation journey")}</small>
              <ol>
                {CANONICAL_CREATION_JOURNEY.map((item, index) => (
                  <li key={item.id} data-state={index < journeyIndex ? "done" : index === journeyIndex ? "current" : "next"}>
                    <span aria-hidden="true">{index < journeyIndex ? "✓" : index === journeyIndex ? "•" : ""}</span>
                    <b>{canonical(item.label)}</b>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </details>
      <style jsx global>{`
        .liuiContextIntelligence{position:fixed;z-index:70;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(780px,calc(100% - 24px));pointer-events:none;font-family:Inter,system-ui,-apple-system,sans-serif}
        .liuiContextDetails{pointer-events:auto}
        .liuiContextDetails>summary{list-style:none;display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 11px;border:1px solid rgba(126,190,236,.24);border-radius:15px;background:linear-gradient(145deg,rgba(4,19,37,.86),rgba(8,14,31,.82));box-shadow:0 12px 34px rgba(0,0,0,.28);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);color:#eef7ff;cursor:pointer}
        .liuiContextDetails>summary::-webkit-details-marker{display:none}
        .liuiContextMark{display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:linear-gradient(145deg,#ffe58b,#c98b1f);color:#101925;font-weight:950;flex:0 0 auto}
        .liuiContextDetails>summary strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .liuiContextGroup{margin-left:auto;color:#a9bac8;font-size:10px;white-space:nowrap}
        .liuiContextRisk{color:#8ce0b8;font-size:10px;white-space:nowrap}
        .liuiContextDetails[open]>summary{border-color:rgba(242,200,98,.42);border-radius:15px 15px 10px 10px}
        .liuiContextPanel{margin-top:7px;max-height:min(72vh,650px);overflow:auto;padding:13px;border:1px solid rgba(126,190,236,.25);border-radius:18px;background:linear-gradient(155deg,rgba(4,19,37,.96),rgba(10,14,31,.96));box-shadow:0 28px 70px rgba(0,0,0,.45);color:#eef7ff}
        .liuiContextBento{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .liuiContextBento section,.liuiContextNext,.liuiContextJourney{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(7,24,45,.68)}
        .liuiContextBento small,.liuiContextNext>small,.liuiContextJourney>small{display:block;color:#829aae;font-size:8px;letter-spacing:.11em;text-transform:uppercase;font-weight:900}
        .liuiContextBento b{display:block;margin-top:5px;font-size:11px;line-height:1.35}
        .liuiContextNext{margin-top:9px}.liuiContextNext h3{margin:5px 0 3px;font-size:16px}.liuiContextNext p{margin:0;color:#9db0bf;font-size:10px;line-height:1.45}
        .liuiContextJourney{margin-top:9px}.liuiContextJourney ol{list-style:none;padding:0;margin:9px 0 0;display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.liuiContextJourney li{display:grid;grid-template-columns:24px 1fr;align-items:center;gap:5px;min-width:0;padding:7px;border:1px solid rgba(255,255,255,.06);border-radius:10px;color:#758da0}.liuiContextJourney li span{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:50%;font-size:9px}.liuiContextJourney li b{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.liuiContextJourney li[data-state="done"]{color:#8fd9b8}.liuiContextJourney li[data-state="current"]{color:#f2d171;border-color:rgba(242,200,98,.35);background:rgba(242,200,98,.06)}
        @media(max-width:720px){.liuiContextIntelligence{top:max(8px,env(safe-area-inset-top));width:calc(100% - 16px)}.liuiContextRisk{display:none}.liuiContextPanel{max-height:68vh}.liuiContextBento{grid-template-columns:1fr}.liuiContextJourney ol{display:flex;overflow:auto;scrollbar-width:none}.liuiContextJourney li{min-width:110px}}
      `}</style>
    </aside>
  );
}
