package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;

/** Minimal local truth for the future Android Web Shield. */
public final class WebShieldStateStore {
    public static final class State {
        public final boolean userOptedIn;
        public final boolean vpnConsentGranted;
        public final boolean tunnelEstablished;
        public final boolean engineHealthy;
        public final boolean policyFresh;
        public final long lastStateChangeMs;
        public final String lastReason;

        State(boolean userOptedIn,
              boolean vpnConsentGranted,
              boolean tunnelEstablished,
              boolean engineHealthy,
              boolean policyFresh,
              long lastStateChangeMs,
              String lastReason) {
            this.userOptedIn = userOptedIn;
            this.vpnConsentGranted = vpnConsentGranted;
            this.tunnelEstablished = tunnelEstablished;
            this.engineHealthy = engineHealthy;
            this.policyFresh = policyFresh;
            this.lastStateChangeMs = lastStateChangeMs;
            this.lastReason = lastReason;
        }

        public NetworkProtectionCapability.Evidence asCapabilityEvidence() {
            return new NetworkProtectionCapability.Evidence(
                    true,
                    userOptedIn,
                    vpnConsentGranted,
                    tunnelEstablished,
                    policyFresh,
                    engineHealthy);
        }
    }

    private static final String PREFS = "laneriq_web_shield_state";
    private final SharedPreferences prefs;

    public WebShieldStateStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void setUserOptedIn(boolean enabled) {
        edit(enabled,
                prefs.getBoolean("vpn_consent", false),
                prefs.getBoolean("tunnel_established", false),
                prefs.getBoolean("engine_healthy", false),
                prefs.getBoolean("policy_fresh", false),
                enabled ? "user-opt-in" : "user-opt-out");
    }

    public void markConsent(boolean granted, String reason) {
        edit(prefs.getBoolean("user_opted_in", false),
                granted,
                granted && prefs.getBoolean("tunnel_established", false),
                granted && prefs.getBoolean("engine_healthy", false),
                prefs.getBoolean("policy_fresh", false),
                reason);
    }

    public void markTunnel(boolean established, boolean engineHealthy, boolean policyFresh, String reason) {
        edit(prefs.getBoolean("user_opted_in", false),
                prefs.getBoolean("vpn_consent", false),
                established,
                engineHealthy,
                policyFresh,
                reason);
    }

    public void markStopped(String reason) {
        edit(prefs.getBoolean("user_opted_in", false),
                prefs.getBoolean("vpn_consent", false),
                false,
                false,
                prefs.getBoolean("policy_fresh", false),
                reason);
    }

    public State read() {
        return new State(
                prefs.getBoolean("user_opted_in", false),
                prefs.getBoolean("vpn_consent", false),
                prefs.getBoolean("tunnel_established", false),
                prefs.getBoolean("engine_healthy", false),
                prefs.getBoolean("policy_fresh", false),
                prefs.getLong("changed_at", 0L),
                prefs.getString("reason", "never-started"));
    }

    private void edit(boolean optedIn,
                      boolean consent,
                      boolean tunnel,
                      boolean healthy,
                      boolean policyFresh,
                      String reason) {
        prefs.edit()
                .putBoolean("user_opted_in", optedIn)
                .putBoolean("vpn_consent", consent)
                .putBoolean("tunnel_established", tunnel)
                .putBoolean("engine_healthy", healthy)
                .putBoolean("policy_fresh", policyFresh)
                .putLong("changed_at", System.currentTimeMillis())
                .putString("reason", reason == null ? "unspecified" : reason)
                .apply();
    }
}
