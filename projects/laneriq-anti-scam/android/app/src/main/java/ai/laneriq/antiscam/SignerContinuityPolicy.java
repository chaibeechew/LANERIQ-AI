package ai.laneriq.antiscam;

import java.util.Locale;

public final class SignerContinuityPolicy {
    public enum State {
        BASELINE_REQUIRED,
        CONTINUITY_VERIFIED,
        MISMATCH,
        UNAVAILABLE
    }

    public static final class Decision {
        public final State state;
        public final boolean continuityAcceptable;
        public final boolean shouldPinBaseline;
        public final boolean unexpectedSignerChange;
        public final String reason;

        Decision(State state,
                 boolean continuityAcceptable,
                 boolean shouldPinBaseline,
                 boolean unexpectedSignerChange,
                 String reason) {
            this.state = state;
            this.continuityAcceptable = continuityAcceptable;
            this.shouldPinBaseline = shouldPinBaseline;
            this.unexpectedSignerChange = unexpectedSignerChange;
            this.reason = reason;
        }
    }

    private SignerContinuityPolicy() {}

    public static Decision evaluate(String pinnedSha256, String currentSha256) {
        String pinned = normalize(pinnedSha256);
        String current = normalize(currentSha256);
        if (current.isEmpty()) {
            return new Decision(State.UNAVAILABLE, false, false, false,
                    "current app signing identity unavailable");
        }
        if (pinned.isEmpty()) {
            return new Decision(State.BASELINE_REQUIRED, true, true, false,
                    "establish signer continuity baseline");
        }
        if (pinned.equals(current)) {
            return new Decision(State.CONTINUITY_VERIFIED, true, false, false,
                    "app signer matches stored continuity baseline");
        }
        return new Decision(State.MISMATCH, false, false, true,
                "app signer changed unexpectedly");
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.US);
    }
}
