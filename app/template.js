import "./laneriq-lotus-brand.css";
import "./laneriq-launch-splash.css";
import "./auth/auth-living-intelligence.css";
import "./auth/auth-lotus-brand-override.css";
import "./living-intelligence-refresh.css";
import "./laneriq-brand-lock.css";
import "./liui-lotus-surface-refresh.css";
import "./liui-runtime-safe-area-fixes.css";
import "./canonical-core-ui.css";
import LaneriqLaunchSplash from "./components/LaneriqLaunchSplash";
import CanonicalCoreUIOwner from "./components/CanonicalCoreUIOwner";

export default function Template({ children }) {
  return <>
    <LaneriqLaunchSplash />
    <CanonicalCoreUIOwner />
    {children}
  </>;
}
