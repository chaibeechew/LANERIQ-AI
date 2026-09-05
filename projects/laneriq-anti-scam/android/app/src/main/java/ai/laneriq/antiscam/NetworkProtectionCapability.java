package ai.laneriq.antiscam;

public final class NetworkProtectionCapability {
    public enum State {
        MANUAL_CHECK_ONLY,
        WEB_SHIELD_READY_NOT_ACTIVE,
        SYSTEM_WIDE_ACTIVE,
        DEGRADED
    }

    public static final class Evidence {
        public final boolean featureImplemented;
        public final boolean userOptedIn;
        public final boolean vpnOrNetworkPermissionGranted;
        public final boolean tunnelOrNetworkFilterEstablished;
        public final boolean threatPolicyFresh;
        public final boolean engineHealthy;

        public Evidence(boolean featureImplemented,
                        boolean userOptedIn,
                        boolean vpnOrNetworkPermissionGranted,
                        boolean tunnelOrNetworkFilterEstablished,
                        boolean threatPolicyFresh,
                        boolean engineHealthy) {
            this.featureImplemented = featureImplemented;
            this.userOptedIn = userOptedIn;
            this.vpnOrNetworkPermissionGranted = vpnOrNetworkPermissionGranted;
            this.tunnelOrNetworkFilterEstablished = tunnelOrNetworkFilterEstablished;
            this.threatPolicyFresh = threatPolicyFresh;
            this.engineHealthy = engineHealthy;
        }
    }

    private NetworkProtectionCapability() {}

    public static State evaluate(Evidence evidence) {
        if (evidence == null || !evidence.featureImplemented) return State.MANUAL_CHECK_ONLY;
        if (!evidence.userOptedIn) return State.WEB_SHIELD_READY_NOT_ACTIVE;
        if (!evidence.vpnOrNetworkPermissionGranted || !evidence.tunnelOrNetworkFilterEstablished) {
            return State.WEB_SHIELD_READY_NOT_ACTIVE;
        }
        if (!evidence.threatPolicyFresh || !evidence.engineHealthy) return State.DEGRADED;
        return State.SYSTEM_WIDE_ACTIVE;
    }

    public static boolean mayClaimSystemWideBlocking(Evidence evidence) {
        return evaluate(evidence) == State.SYSTEM_WIDE_ACTIVE;
    }
}
