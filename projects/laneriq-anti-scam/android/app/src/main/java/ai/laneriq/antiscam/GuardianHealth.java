package ai.laneriq.antiscam;

public final class GuardianHealth {
    public enum State {
        HEALTHY,
        REVIEW_REQUIRED,
        DEGRADED,
        PAUSED,
        UNKNOWN
    }

    private GuardianHealth() {}

    public static State evaluate(
            ProtectionTruth.State truth,
            String localRiskLevel,
            boolean resourceConstrained,
            int recentRestartFailures) {
        if (truth == null) return State.UNKNOWN;
        if (truth == ProtectionTruth.State.PAUSED) return State.PAUSED;
        if (truth == ProtectionTruth.State.UNKNOWN) return State.UNKNOWN;
        if (truth != ProtectionTruth.State.ACTIVE) return State.DEGRADED;
        if (recentRestartFailures >= 3) return State.DEGRADED;

        String risk = localRiskLevel == null ? "unknown" : localRiskLevel.trim().toLowerCase();
        if ("elevated".equals(risk) || "review".equals(risk)) {
            return State.REVIEW_REQUIRED;
        }
        if ("unknown".equals(risk)) return State.UNKNOWN;

        // Resource throttling alone must not create a false protection failure.
        // The persistent notification may disclose reduced cadence separately.
        return State.HEALTHY;
    }

    public static boolean mayClaimGuardianActive(State state) {
        return state == State.HEALTHY || state == State.REVIEW_REQUIRED;
    }
}
