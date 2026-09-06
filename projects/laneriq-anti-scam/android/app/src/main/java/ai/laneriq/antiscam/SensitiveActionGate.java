package ai.laneriq.antiscam;

public final class SensitiveActionGate {
    public enum Context { GENERAL, LOGIN, PAYMENT, BANKING, PASSWORD_CHANGE, RECOVERY }
    public enum Action { ALLOW, WARN, FREEZE }

    public static final class Signals {
        public final boolean webBlocked;
        public final boolean knownMaliciousDestination;
        public final int remoteControlSignalCount;
        public final boolean suspiciousNewApp;
        public final boolean guardianFresh;
        public final boolean unexpectedProtectionLoss;

        public Signals(boolean webBlocked,
                       boolean knownMaliciousDestination,
                       int remoteControlSignalCount,
                       boolean suspiciousNewApp,
                       boolean guardianFresh) {
            this(webBlocked,
                    knownMaliciousDestination,
                    remoteControlSignalCount,
                    suspiciousNewApp,
                    guardianFresh,
                    false);
        }

        public Signals(boolean webBlocked,
                       boolean knownMaliciousDestination,
                       int remoteControlSignalCount,
                       boolean suspiciousNewApp,
                       boolean guardianFresh,
                       boolean unexpectedProtectionLoss) {
            this.webBlocked = webBlocked;
            this.knownMaliciousDestination = knownMaliciousDestination;
            this.remoteControlSignalCount = Math.max(0, remoteControlSignalCount);
            this.suspiciousNewApp = suspiciousNewApp;
            this.guardianFresh = guardianFresh;
            this.unexpectedProtectionLoss = unexpectedProtectionLoss;
        }
    }

    public static final class Decision {
        public final Action action;
        public final String reason;

        Decision(Action action, String reason) {
            this.action = action;
            this.reason = reason;
        }
    }

    private SensitiveActionGate() {}

    public static Decision evaluate(Context context, Signals signals) {
        if (signals == null) return new Decision(Action.WARN, "missing protection evidence");
        boolean sensitive = context == Context.PAYMENT
                || context == Context.BANKING
                || context == Context.PASSWORD_CHANGE
                || context == Context.RECOVERY;

        if (signals.knownMaliciousDestination) {
            return new Decision(Action.FREEZE, "known malicious destination");
        }
        if (sensitive && signals.unexpectedProtectionLoss) {
            return new Decision(Action.FREEZE,
                    "guardian protection was lost unexpectedly during a sensitive action");
        }
        if (sensitive && signals.webBlocked && signals.remoteControlSignalCount >= 1) {
            return new Decision(Action.FREEZE, "web risk plus remote-control signal during sensitive action");
        }
        if (sensitive && signals.remoteControlSignalCount >= 2) {
            return new Decision(Action.FREEZE, "multiple remote-control risk signals during sensitive action");
        }
        if (sensitive && signals.suspiciousNewApp && signals.remoteControlSignalCount >= 1) {
            return new Decision(Action.FREEZE, "new-app risk plus remote-control signal during sensitive action");
        }
        if (!signals.guardianFresh && sensitive) {
            return new Decision(Action.WARN, "guardian protection evidence is not fresh");
        }
        if (signals.webBlocked || signals.remoteControlSignalCount >= 1 || signals.suspiciousNewApp) {
            return new Decision(Action.WARN, "risk signal requires user review");
        }
        return new Decision(Action.ALLOW, "no blocking evidence found in available signals");
    }
}
