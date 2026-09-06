import "./laneriq-launch-splash.css";
import "./auth/auth-living-intelligence.css";
import LaneriqLaunchSplash from "./components/LaneriqLaunchSplash";

export default function Template({ children }) {
  return <>
    <LaneriqLaunchSplash />
    {children}
  </>;
}
