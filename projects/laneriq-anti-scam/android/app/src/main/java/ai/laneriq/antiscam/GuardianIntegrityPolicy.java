package ai.laneriq.antiscam;

/**
 * Truth policy for Guardian survival / anti-tamper state.
 *
 * Important boundary: an unexpected protection loss can be caused by an OS
 * lifecycle event, force-stop, crash, policy restriction, or an attacker. This
 * policy never attributes the cause to a hacker without separate evidence.
 */
public final class GuardianIntegrityPolicy {
    public enum State {
        ACTIVE,
        USER_PAUSED,
        VERIFYING,
        PROTECTION_LOST_UNEXPECTEDLY,
        RESTORE_THROTTLED,
        UNKNOWN
    }

    public static final class Evidence {
        public final boolean userOptedIn;
        public final boolean claimableActive;
        public final boolean serviceEnabled;
        public final boolean sameBootSession;
        public final long heartbeatSequence;
        public final ProtectionTruth.State leaseState;
        public final String lastStopReason;
        public final int recentRestartAttempts;

        public Evidence(boolean userOptedIn,
                        boolean claimableActive,
                        boolean serviceEnabled,
                        boolean sameBootSession,
                        long heartbeatSequence,
                        ProtectionTruth.State leaseState,
                        String lastStopReason,
                        int recentRestartAttempts) {
            this.userOptedIn = userOptedIn;
            this.claimableActive = claimableActive;
            this.serviceEnabled = serviceEnabled;
            this.sameBootSession = sameBootSession;
            this.heartbeatSequence = Math.max(0L, heartbeatSequence);
            this.leaseState = leaseState == null ? ProtectionTruth.State.UNKNOWN : leaseState;
            this.lastStopReason = lastStopReason == null ? "" : lastStopReason.trim();
            this.recentRestartAttempts = Math.max(0, recentRestartAttempts);
        }
    }

    public static final class Decision {
        public final State state;
        public final boolean mayClaimProtected;
        public final boolean unexpectedProtectionLoss;
        public final boolean freezeSensitiveLaneriqActions;
        public final boolean hackerAttributionAllowed;
        public final String reason;

        Decision(State state,
                 boolean mayClaimProtected,
                 boolean unexpectedProtectionLoss,
                 boolean freezeSensitiveLaneriqActions,
                 String reason) {
            this.state = state;
            this.mayClaimProtected = mayClaimProtected;
            this.unexpectedProtectionLoss = unexpectedProtectionLoss;
            this.freezeSensitiveLaneriqActions = freezeSensitiveLaneriqActions;
            this.hackerAttributionAllowed = false;
            this.reason = reason;
        }
    }

    private GuardianIntegrityPolicy() {}

    public static Decision evaluate(Evidence evidence) {
        if (evidence == null) {
            return new Decision(State.UNKNOWN, false, false, true,
                    "missing guardian integrity evidence");
        }

        if (!evidence.userOptedIn) {
            return new Decision(State.USER_PAUSED, false, false, false,
                    "guardian paused by user choice");
        }

        if (evidence.claimableActive
                && evidence.leaseState == ProtectionTruth.State.ACTIVE
                && evidence.sameBootSession
                && evidence.heartbeatSequence > 0L) {
            return new Decision(State.ACTIVE, true, false, false,
                    "fresh same-boot guardian lease");
        }

        if (evidence.recentRestartAttempts >= RestartCircuitBreaker.MAX_RESTARTS_IN_WINDOW) {
            return new Decision(State.RESTORE_THROTTLED, false, true, true,
                    "automatic guardian restore circuit is open");
        }

        if (evidence.leaseState == ProtectionTruth.State.DEGRADED_STALE) {
            return new Decision(State.PROTECTION_LOST_UNEXPECTEDLY, false, true, true,
                    "guardian heartbeat expired while protection remained opted in");
        }

        if (evidence.leaseState == ProtectionTruth.State.DEGRADED_OFFLINE) {
            return new Decision(State.PROTECTION_LOST_UNEXPECTEDLY, false, true, true,
                    evidence.lastStopReason.isEmpty()
                            ? "guardian service offline while protection remained opted in"
                            : "guardian service offline: " + evidence.lastStopReason);
        }

        if (evidence.leaseState == ProtectionTruth.State.DEGRADED_CLOCK) {
            return new Decision(State.PROTECTION_LOST_UNEXPECTEDLY, false, true, true,
                    "guardian time/session evidence is not trustworthy");
        }

        if (!evidence.sameBootSession || evidence.heartbeatSequence == 0L) {
            return new Decision(State.VERIFYING, false, false, true,
                    "guardian must establish a fresh boot-session heartbeat");
        }

        if (!evidence.serviceEnabled) {
            return new Decision(State.PROTECTION_LOST_UNEXPECTEDLY, false, true, true,
                    "guardian service is disabled while protection remains opted in");
        }

        return new Decision(State.UNKNOWN, false, false, true,
                "guardian integrity cannot be proven from current evidence");
    }

    public static Decision evaluate(ProtectionLeaseStore.Lease lease) {
        if (lease == null) return evaluate((Evidence) null);
        return evaluate(new Evidence(
                lease.userOptedIn,
                lease.mayClaimGuardianActive(),
                lease.serviceEnabled,
                lease.sameBootSession,
                lease.heartbeatSequence,
                lease.state,
                lease.lastStopReason,
                lease.recentRestartAttempts));
    }
}
