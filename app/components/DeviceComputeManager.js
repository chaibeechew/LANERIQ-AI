"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEVICE_COMPUTE_EVENT,
  DEVICE_COMPUTE_POLICY_VERSION,
  DEVICE_COMPUTE_STORAGE_KEY,
  classifyDevice,
  computeDeviceBudget,
  createDefaultDeviceComputeSettings,
  sanitizeDeviceComputeSettings,
} from "../../lib/device-compute/policy.js";

function installationId() {
  try {
    if (globalThis.crypto?.randomUUID) return `device-${globalThis.crypto.randomUUID()}`;
  } catch {}
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readSettings() {
  if (typeof window === "undefined") return createDefaultDeviceComputeSettings();
  try {
    const raw = window.localStorage.getItem(DEVICE_COMPUTE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return sanitizeDeviceComputeSettings(parsed);
  } catch {
    return createDefaultDeviceComputeSettings();
  }
}

function writeSettings(settings) {
  const safe = sanitizeDeviceComputeSettings(settings);
  try { window.localStorage.setItem(DEVICE_COMPUTE_STORAGE_KEY, JSON.stringify(safe)); } catch {}
  return safe;
}

function nativeThermalState() {
  try {
    return String(window.__LANERIQ_NATIVE_TELEMETRY__?.thermalState || "unknown");
  } catch {
    return "unknown";
  }
}

function deviceInputs() {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  return {
    userAgent: nav.userAgent || "",
    hardwareConcurrency: Number(nav.hardwareConcurrency || 1),
    deviceMemory: Number(nav.deviceMemory || 0),
    maxTouchPoints: Number(nav.maxTouchPoints || 0),
  };
}

export default function DeviceComputeManager() {
  const [settings, setSettings] = useState(() => createDefaultDeviceComputeSettings());
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [battery, setBattery] = useState({ level: null, charging: false });
  const [thermalState, setThermalState] = useState("unknown");
  const [storagePersistent, setStoragePersistent] = useState(null);

  useEffect(() => {
    const initial = readSettings();
    setSettings(initial);
    setReady(true);
    let mounted = true;

    (async () => {
      try {
        const response = await fetch("/api/auth/session", { method: "GET", cache: "no-store", credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (mounted) setAuthenticated(response.ok && data?.authenticated === true && data?.sessionAuthority === "laneriq");
      } catch {
        if (mounted) setAuthenticated(false);
      }
    })();

    const updateThermal = () => { if (mounted) setThermalState(nativeThermalState()); };
    updateThermal();
    window.addEventListener("laneriq:native-telemetry", updateThermal);

    let batteryManager = null;
    const updateBattery = () => {
      if (!mounted || !batteryManager) return;
      setBattery({
        level: Number.isFinite(Number(batteryManager.level)) ? Number(batteryManager.level) : null,
        charging: batteryManager.charging === true,
      });
    };
    if (typeof navigator?.getBattery === "function") {
      navigator.getBattery().then((manager) => {
        if (!mounted) return;
        batteryManager = manager;
        updateBattery();
        manager.addEventListener?.("levelchange", updateBattery);
        manager.addEventListener?.("chargingchange", updateBattery);
      }).catch(() => {});
    }

    if (navigator?.storage?.persisted) {
      navigator.storage.persisted().then((value) => { if (mounted) setStoragePersistent(Boolean(value)); }).catch(() => {});
    }

    return () => {
      mounted = false;
      window.removeEventListener("laneriq:native-telemetry", updateThermal);
      batteryManager?.removeEventListener?.("levelchange", updateBattery);
      batteryManager?.removeEventListener?.("chargingchange", updateBattery);
    };
  }, []);

  const snapshot = useMemo(() => {
    if (!ready) return null;
    const input = deviceInputs();
    const deviceClass = classifyDevice(input);
    const budget = computeDeviceBudget({
      settings,
      deviceClass,
      thermalState,
      batteryLevel: battery.level,
      charging: battery.charging,
      visibility: typeof document !== "undefined" ? document.visibilityState : "visible",
      hardwareConcurrency: input.hardwareConcurrency,
    });
    return {
      policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
      settings,
      deviceClass,
      budget,
      storagePersistent,
      nativeThermalTelemetry: thermalState !== "unknown",
    };
  }, [battery.charging, battery.level, ready, settings, storagePersistent, thermalState]);

  useEffect(() => {
    if (!snapshot) return;
    const api = Object.freeze({
      getSnapshot: () => snapshot,
      policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
      motherAiIdentity: "LANERIQ AI",
      adaptiveComputeMaxShare: 0.05,
      communityComputePreferenceEnabled: snapshot.settings.communityComputeEnabled === true,
      communityComputeExecutionLive: false,
      crossUserComputeExecutionAllowed: false,
    });
    window.__LANERIQ_DEVICE_COMPUTE__ = api;
    window.dispatchEvent(new CustomEvent(DEVICE_COMPUTE_EVENT, { detail: snapshot }));
    return () => {
      if (window.__LANERIQ_DEVICE_COMPUTE__ === api) delete window.__LANERIQ_DEVICE_COMPUTE__;
    };
  }, [snapshot]);

  async function saveDecision(decision) {
    const next = writeSettings({
      ...settings,
      policyVersion: DEVICE_COMPUTE_POLICY_VERSION,
      decision,
      localComputeEnabled: decision === "local",
      mode: decision === "local" ? "balanced" : settings.mode,
      backgroundComputeEnabled: false,
      ownDesktopRemoteComputeEnabled: false,
      communityComputeEnabled: false,
      communityComputeConsentAt: null,
      crossUserComputeEnabled: false,
      thermalGuardianEnabled: true,
      consentAt: new Date().toISOString(),
      installationId: settings.installationId || installationId(),
    });
    setSettings(next);

    if (decision === "local" && next.keepLocalProjectData && navigator?.storage?.persist) {
      try {
        const persisted = await navigator.storage.persist();
        setStoragePersistent(Boolean(persisted));
      } catch {}
    }
  }

  if (!ready || !authenticated || settings.decision) return null;

  return <div className="dcBackdrop" role="presentation">
    <section className="dcCard" role="dialog" aria-modal="true" aria-labelledby="laneriq-local-compute-title">
      <div className="dcEyebrow">LANERIQ AI · MOTHER AI DEVICE INTELLIGENCE</div>
      <h2 id="laneriq-local-compute-title">Let Mother AI use a small amount of unused device compute?</h2>
      <p className="dcLead"><b>Mother AI is LANERIQ AI&apos;s core intelligence.</b> With your permission, it can use a small adaptive share of this device&apos;s CPU, GPU or NPU for your own AI work, normally around 0–3% and never above the 5% scheduler ceiling.</p>
      <div className="dcGrid">
        <div><b>🧠 Intelligence before compute</b><span>Mother AI only uses extra local compute when it helps your experience. 0% is always a valid state.</span></div>
        <div><b>🌡 Thermal Guardian</b><span>Always on. Heat pressure, low battery or foreground demand can reduce the budget to 0% immediately.</span></div>
        <div><b>🔒 Personal Compute first</b><span>Your device first helps your own LANERIQ tasks. Community Compute remains OFF unless you enable it separately.</span></div>
        <div><b>🛡 Privacy by design</b><span>Compute permission is not permission to read unrelated files, messages, passwords, contacts or browsing history.</span></div>
      </div>
      <p className="dcFine">Background Compute, linked-Desktop compute and Community Compute all stay OFF until you enable them separately. LANERIQ does not invent browser temperature readings; richer thermal feedback is used only when an installed native runtime provides it. You can change this anytime in Device &amp; Compute settings.</p>
      <div className="dcActions">
        <button className="dcPrimary" type="button" onClick={() => void saveDecision("local")}>Allow Mother AI Device Intelligence — Recommended</button>
        <button className="dcSecondary" type="button" onClick={() => void saveDecision("cloud_only")}>Use Cloud Only</button>
      </div>
    </section>
    <style jsx>{`
      .dcBackdrop{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:max(18px,env(safe-area-inset-top)) 14px max(18px,env(safe-area-inset-bottom));background:rgba(0,7,5,.72);backdrop-filter:blur(16px);font-family:Inter,system-ui,-apple-system,sans-serif;color:#edf7f2}.dcCard{width:min(720px,100%);max-height:calc(100svh - 36px);overflow:auto;padding:26px;border:1px solid rgba(230,202,104,.3);border-radius:26px;background:linear-gradient(180deg,rgba(5,28,21,.98),rgba(2,15,12,.98));box-shadow:0 32px 110px rgba(0,0,0,.62)}.dcEyebrow{font-size:10px;font-weight:1000;letter-spacing:.16em;color:#e5cb70}.dcCard h2{margin:9px 0 12px;font-size:clamp(28px,6vw,46px);line-height:1.04}.dcLead{margin:0;color:#bccdc5;line-height:1.65;font-size:14px}.dcLead b{color:#f3da82}.dcGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:20px 0 14px}.dcGrid div{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.035)}.dcGrid b{display:block;font-size:12px;color:#f1d879}.dcGrid span{display:block;margin-top:5px;color:#9fb2a9;font-size:11px;line-height:1.5}.dcFine{font-size:10px;line-height:1.6;color:#82988e}.dcActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}.dcActions button{min-height:52px;border-radius:15px;font-weight:1000;cursor:pointer;touch-action:manipulation}.dcPrimary{border:1px solid #efd66f;background:linear-gradient(135deg,#f2db7d,#b9872d);color:#06110d}.dcSecondary{border:1px solid rgba(255,255,255,.13);background:transparent;color:#d8e3de}@media(max-width:620px){.dcCard{padding:20px;border-radius:22px}.dcGrid,.dcActions{grid-template-columns:1fr}.dcActions button{min-height:54px}.dcLead{font-size:13px}}
    `}</style>
  </div>;
}
