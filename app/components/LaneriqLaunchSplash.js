"use client";

import { useEffect, useState } from "react";
import LaneriqLotusBrand from "./LaneriqLotusBrand";

const SPLASH_SESSION_KEY = "laneriq:living-intelligence-splash:v2";
const DISPLAY_MS = 1850;

export default function LaneriqLaunchSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "shown";
    } catch {}
    if (alreadyShown) return undefined;

    setVisible(true);
    try { window.sessionStorage.setItem(SPLASH_SESSION_KEY, "shown"); } catch {}

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const leaveTimer = window.setTimeout(() => setLeaving(true), reduceMotion ? 520 : DISPLAY_MS);
    const removeTimer = window.setTimeout(() => setVisible(false), reduceMotion ? 650 : DISPLAY_MS + 520);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`laneriqLaunchSplash${leaving ? " isLeaving" : ""}`} role="status" aria-label="Opening LANERIQ AI">
      <div className="laneriqLaunchBackdrop" aria-hidden="true" />
      <div className="laneriqLaunchHalo laneriqLaunchHaloA" aria-hidden="true" />
      <div className="laneriqLaunchHalo laneriqLaunchHaloB" aria-hidden="true" />
      <div className="laneriqLaunchContent">
        <LaneriqLotusBrand className="laneriqLaunchLotus" ariaLabel="LANERIQ AI — Living Intelligence" />
        <div className="laneriqLaunchRule" aria-hidden="true"><i /><b /><i /></div>
        <p>Ideas · People · Technology · A Brighter Tomorrow</p>
        <div className="laneriqLaunchProgress" aria-hidden="true"><span /></div>
      </div>
      <div className="laneriqLaunchFooter">A BRIGHTER TOMORROW TOGETHER</div>
    </div>
  );
}
