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
    </aside>
  );
}
