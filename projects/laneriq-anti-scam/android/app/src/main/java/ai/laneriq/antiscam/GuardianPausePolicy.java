package ai.laneriq.antiscam;

public final class GuardianPausePolicy {
    public enum Action {
        REQUIRE_CONFIRMATION,
        REQUIRE_HIGH_FRICTION_REVIEW,
        BLOCK_DURING_URGENT_RISK
    }

    public static final class Decision {
        public final Action action;
        public final boolean mayStopImmediately;
        public final String reason;

        Decision(Action action, boolean mayStopImmediately, String reason) {
            this.action = action;
            this.mayStopImmediately = mayStopImmediately;
            this.reason = reason;
        }
    }

    private GuardianPausePolicy() {}

    public static Decision evaluate(int remoteControlSignalCount,
                                    EmergencyModeStore.Level emergencyLevel,
                                    boolean unexpectedProtectionLoss,
                                    boolean selfIntegrityMismatch) {
        int signals = Math.max(0, remoteControlSignalCount);
        EmergencyModeStore.Level emergency = emergencyLevel == null
                ? EmergencyModeStore.Level.NONE
                : emergencyLevel;

        if (selfIntegrityMismatch
                || emergency == EmergencyModeStore.Level.URGENT
                || signals >= 2) {
            return new Decision(
                    Action.BLOCK_DURING_URGENT_RISK,
                    false,
                    "ordinary pause is blocked while urgent anti-tamper or remote-control risk is present");
        }

        if (unexpectedProtectionLoss || signals == 1 || emergency == EmergencyModeStore.Level.REVIEW) {
            return new Decision(
                    Action.REQUIRE_HIGH_FRICTION_REVIEW,
                    false,
                    "pause requires additional review while protection integrity or device risk needs attention");
        }

        return new Decision(
                Action.REQUIRE_CONFIRMATION,
                false,
                "explicit user confirmation is required before pausing Guardian protection");
    }
}
