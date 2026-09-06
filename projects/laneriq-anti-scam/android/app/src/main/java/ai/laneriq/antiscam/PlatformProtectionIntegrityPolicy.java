package ai.laneriq.antiscam;

/**
 * Pure policy for Android platform conditions that can reduce protection.
 * None of these signals alone proves attacker activity.
 */
public final class PlatformProtectionIntegrityPolicy {
    public enum State {
        HEALTHY,
        ALERTS_DEGRADED,
        BACKGROUND_RESTRICTED,
        POWER_RESTRICTED,
        MULTIPLE_RESTRICTIONS,
        UNKNOWN
    }

    public static final class Evidence {
        public final boolean evidenceAvailable;
        public final boolean alertsAvailable;
        public final boolean backgroundRestricted;
        public final boolean batteryOptimizationExemption;

        public Evidence(boolean evidenceAvailable,
                        boolean alertsAvailable,
                        boolean backgroundRestricted,
                        boolean batteryOptimizationExemption) {
            this.evidenceAvailable = evidenceAvailable;
            this.alertsAvailable = alertsAvailable;
            this.backgroundRestricted = backgroundRestricted;
            this.batteryOptimizationExemption = batteryOptimizationExemption;
        }
    }

    public static final class Decision {
        public final State state;
        public final boolean mayClaimFullGuardianDelivery;
        public final boolean freezeSensitiveLaneriqActions;
        public final boolean hackerAttributionAllowed;
        public final String reason;

        Decision(State state,
                 boolean mayClaimFullGuardianDelivery,
                 boolean freezeSensitiveLaneriqActions,
                 String reason) {
            this.state = state;
            this.mayClaimFullGuardianDelivery = mayClaimFullGuardianDelivery;
            this.freezeSensitiveLaneriqActions = freezeSensitiveLaneriqActions;
            this.hackerAttributionAllowed = false;
            this.reason = reason;
        }
    }

    private PlatformProtectionIntegrityPolicy() {}

    public static Decision evaluate(Evidence evidence) {
        if (evidence == null || !evidence.evidenceAvailable) {
            return new Decision(State.UNKNOWN, false, false,
                    "platform protection evidence unavailable");
        }
        int restrictions = 0;
        if (!evidence.alertsAvailable) restrictions++;
        if (evidence.backgroundRestricted) restrictions++;
        if (!evidence.batteryOptimizationExemption) restrictions++;

        if (restrictions >= 2) {
            return new Decision(State.MULTIPLE_RESTRICTIONS, false, false,
                    "multiple Android delivery/background constraints may reduce Guardian reliability");
        }
        if (!evidence.alertsAvailable) {
            return new Decision(State.ALERTS_DEGRADED, false, false,
                    "risk alerts are not currently deliverable");
        }
        if (evidence.backgroundRestricted) {
            return new Decision(State.BACKGROUND_RESTRICTED, false, false,
                    "Android background restriction is active");
        }
        if (!evidence.batteryOptimizationExemption) {
            return new Decision(State.POWER_RESTRICTED, false, false,
                    "battery optimization may delay background Guardian work");
        }
        return new Decision(State.HEALTHY, true, false,
                "no platform delivery/background restriction found in available evidence");
    }
}
