package ai.laneriq.antiscam;

public final class WebShieldPolicy {
    public enum Reputation { KNOWN_MALICIOUS, HIGH_RISK, UNKNOWN, KNOWN_BENIGN }
    public enum Action { BLOCK, INTERSTITIAL, ALLOW_WITH_CAUTION }

    public static final class Decision {
        public final Action action;
        public final String reason;
        public final boolean knownMaliciousEvidence;

        Decision(Action action, String reason, boolean knownMaliciousEvidence) {
            this.action = action;
            this.reason = reason;
            this.knownMaliciousEvidence = knownMaliciousEvidence;
        }
    }

    private WebShieldPolicy() {}

    public static Decision decide(SafeWebEvaluator.Result local, Reputation reputation) {
        if (reputation == Reputation.KNOWN_MALICIOUS) {
            return new Decision(Action.BLOCK, "known malicious reputation", true);
        }
        if (reputation == Reputation.HIGH_RISK) {
            return new Decision(Action.BLOCK, "high-risk threat reputation", false);
        }
        if (local != null && local.decision == SafeWebEvaluator.Decision.BLOCK) {
            return new Decision(Action.BLOCK, "local high-risk web signals", false);
        }
        if (local != null && local.decision == SafeWebEvaluator.Decision.WARN) {
            return new Decision(Action.INTERSTITIAL, "local web risk requires review", false);
        }
        if (reputation == Reputation.KNOWN_BENIGN) {
            return new Decision(Action.ALLOW_WITH_CAUTION,
                    "known-benign reputation plus no blocking local signal", false);
        }
        return new Decision(Action.ALLOW_WITH_CAUTION,
                "no blocking evidence found; unknown does not mean safe", false);
    }
}
