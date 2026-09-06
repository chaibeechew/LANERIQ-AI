package ai.laneriq.antiscam;

public final class InstallSourceContinuityPolicy {
    public enum State { BASELINE_REQUIRED, CONSISTENT, CHANGED, UNAVAILABLE }

    public static final class Decision {
        public final State state;
        public final boolean continuityAcceptable;
        public final boolean unexpectedChange;
        public final boolean shouldPinBaseline;
        public final boolean hackerAttributionAllowed;
        public final String reason;

        Decision(State state, boolean continuityAcceptable, boolean unexpectedChange,
                 boolean shouldPinBaseline, String reason) {
            this.state = state;
            this.continuityAcceptable = continuityAcceptable;
            this.unexpectedChange = unexpectedChange;
            this.shouldPinBaseline = shouldPinBaseline;
            this.hackerAttributionAllowed = false;
            this.reason = reason;
        }
    }

    private InstallSourceContinuityPolicy() {}

    public static Decision evaluate(String pinned, String current) {
        String p = pinned == null ? "" : pinned.trim();
        String c = current == null ? "" : current.trim();
        if (c.isEmpty()) return new Decision(State.UNAVAILABLE, false, false, false,
                "install source unavailable");
        if (p.isEmpty()) return new Decision(State.BASELINE_REQUIRED, true, false, true,
                "first observed install source baseline");
        if (p.equals(c)) return new Decision(State.CONSISTENT, true, false, false,
                "install source matches baseline");
        return new Decision(State.CHANGED, false, true, false,
                "install source changed unexpectedly; review required");
    }
}
