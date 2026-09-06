import "./laneriq-lotus-brand.css";
import "./laneriq-launch-splash.css";
import "./auth/auth-living-intelligence.css";
import "./auth/auth-lotus-brand-override.css";
import "./living-intelligence-refresh.css";
import "./laneriq-brand-lock.css";
import "./liui-lotus-surface-refresh.css";
import LaneriqLaunchSplash from "./components/LaneriqLaunchSplash";

export default function Template({ children }) {
  return <>
    <LaneriqLaunchSplash />
    {children}
  </>;
}
