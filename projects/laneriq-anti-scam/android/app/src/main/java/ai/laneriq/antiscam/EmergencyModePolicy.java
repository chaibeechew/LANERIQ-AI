package ai.laneriq.antiscam;

public final class EmergencyModePolicy {
    public static final int CLEAR_AFTER_LOW_RISK_TICKS = 2;

    public static final class Decision {
        public final EmergencyModeStore.Level level;
        public final int nextLowRiskTicks;
        public final boolean shouldClearStoredState;

        Decision(EmergencyModeStore.Level level, int nextLowRiskTicks, boolean shouldClearStoredState) {
            this.level = level;
            this.nextLowRiskTicks = nextLowRiskTicks;
            this.shouldClearStoredState = shouldClearStoredState;
        }
    }

    private EmergencyModePolicy() {}

    public static Decision evaluate(
            int signalCount,
            EmergencyModeStore.Level currentLevel,
            int consecutiveLowRiskTicks) {
        signalCount = Math.max(0, signalCount);
        int lowTicks = Math.max(0, consecutiveLowRiskTicks);
        EmergencyModeStore.Level current = currentLevel == null
                ? EmergencyModeStore.Level.NONE
                : currentLevel;

        if (signalCount >= 2) {
            return new Decision(EmergencyModeStore.Level.URGENT, 0, false);
        }
        if (signalCount == 1) {
            return new Decision(EmergencyModeStore.Level.REVIEW, 0, false);
        }

        int next = lowTicks + 1;
        if (current == EmergencyModeStore.Level.NONE) {
            return new Decision(EmergencyModeStore.Level.NONE, next, false);
        }
        if (next >= CLEAR_AFTER_LOW_RISK_TICKS) {
            return new Decision(EmergencyModeStore.Level.NONE, next, true);
        }
        return new Decision(current, next, false);
    }
}
