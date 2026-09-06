package ai.laneriq.antiscam;

/**
 * Truth-only VPN ownership policy. Until a real LANERIQ VpnService exists,
 * callers must keep webShieldExpected=false and the result is NOT_APPLICABLE.
 */
public final class VpnOwnershipIntegrityPolicy {
    public enum State { NOT_APPLICABLE, VERIFIED, OWNERSHIP_LOST, UNVERIFIED }

    public static final class Evidence {
        public final boolean webShieldExpected;
        public final boolean laneriqTunnelEstablished;
        public final boolean laneriqTunnelHealthy;
        public final boolean ownershipEvidenceAvailable;
        public final boolean laneriqOwnsActiveTunnel;

        public Evidence(boolean webShieldExpected,
                        boolean laneriqTunnelEstablished,
                        boolean laneriqTunnelHealthy,
                        boolean ownershipEvidenceAvailable,
                        boolean laneriqOwnsActiveTunnel) {
            this.webShieldExpected = webShieldExpected;
            this.laneriqTunnelEstablished = laneriqTunnelEstablished;
            this.laneriqTunnelHealthy = laneriqTunnelHealthy;
            this.ownershipEvidenceAvailable = ownershipEvidenceAvailable;
            this.laneriqOwnsActiveTunnel = laneriqOwnsActiveTunnel;
        }
    }

    public static final class Decision {
        public final State state;
        public final boolean mayClaimSystemWideWebShield;
        public final boolean freezeSensitiveLaneriqActions;
        public final boolean hackerAttributionAllowed;
        public final String reason;

        Decision(State state, boolean mayClaimSystemWideWebShield,
                 boolean freezeSensitiveLaneriqActions, String reason) {
            this.state = state;
            this.mayClaimSystemWideWebShield = mayClaimSystemWideWebShield;
            this.freezeSensitiveLaneriqActions = freezeSensitiveLaneriqActions;
            this.hackerAttributionAllowed = false;
            this.reason = reason;
        }
    }

    private VpnOwnershipIntegrityPolicy() {}

    public static Decision evaluate(Evidence e) {
        if (e == null || !e.webShieldExpected) {
            return new Decision(State.NOT_APPLICABLE, false, false,
                    "system-wide Web Shield is not enabled in this verified build");
        }
        if (!e.ownershipEvidenceAvailable) {
            return new Decision(State.UNVERIFIED, false, true,
                    "VPN ownership cannot be proven");
        }
        if (!e.laneriqOwnsActiveTunnel || !e.laneriqTunnelEstablished || !e.laneriqTunnelHealthy) {
            return new Decision(State.OWNERSHIP_LOST, false, true,
                    "expected LANERIQ network protection tunnel is not the verified active healthy tunnel");
        }
        return new Decision(State.VERIFIED, true, false,
                "LANERIQ network protection tunnel ownership and health are verified");
    }
}
