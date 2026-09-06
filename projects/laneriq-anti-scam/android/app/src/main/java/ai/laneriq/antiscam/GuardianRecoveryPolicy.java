package ai.laneriq.antiscam;

public final class GuardianRecoveryPolicy {
    public enum Action {
        NONE,
        AUTO_RESTORE_ON_USER_OPEN,
        REQUIRE_EXPLICIT_REVIEW,
        USER_PAUSED
    }

    public static final class Decision {
        public final Action action;
        public final boolean mayAttemptServiceStart;
        public final boolean resetProtectedClaimBeforeRestart;
        public final String reason;

        Decision(Action action,
                 boolean mayAttemptServiceStart,
                 boolean resetProtectedClaimBeforeRestart,
                 String reason) {
            this.action = action;
            this.mayAttemptServiceStart = mayAttemptServiceStart;
            this.resetProtectedClaimBeforeRestart = resetProtectedClaimBeforeRestart;
            this.reason = reason;
        }
    }

    private GuardianRecoveryPolicy() {}

    public static Decision evaluate(GuardianIntegrityPolicy.Decision integrity,
                                    boolean userOptedIn,
                                    int recentRestartAttempts) {
        if (!userOptedIn) {
            return new Decision(Action.USER_PAUSED, false, false,
                    "user has not opted into Guardian protection");
        }
        if (integrity != null && integrity.mayClaimProtected) {
            return new Decision(Action.NONE, false, false,
                    "Guardian already has fresh protection evidence");
        }
        if (recentRestartAttempts >= RestartCircuitBreaker.MAX_RESTARTS_IN_WINDOW
                || (integrity != null && integrity.state == GuardianIntegrityPolicy.State.RESTORE_THROTTLED)) {
            return new Decision(Action.REQUIRE_EXPLICIT_REVIEW, false, true,
                    "automatic recovery is throttled after repeated restart failures");
        }
        return new Decision(Action.AUTO_RESTORE_ON_USER_OPEN, true, true,
                "user reopened Anti Scam while opted in but Guardian proof is missing");
    }
}
