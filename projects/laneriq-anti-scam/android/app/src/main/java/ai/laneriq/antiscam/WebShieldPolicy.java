package ai.laneriq.antiscam;

public final class WebShieldPolicy {
    public enum Reputation { KNOWN_MALICIOUS, HIGH_RISK, UNKNOWN, KNOWN_BENIGN }
    public enum Action { BLOCK, INTERSTITIAL, ALLOW_WITH_CAUTION }

    public static final class Decision {
        public final Action action;
        public final String reason;
        public final boolean knownMaliciousEvidence;
        public final boolean userOverrideAllowed;

        Decision(Action action, String reason, boolean knownMaliciousEvidence, boolean userOverrideAllowed) {
            this.action = action;
            this.reason = reason;
            this.knownMaliciousEvidence = knownMaliciousEvidence;
            this.userOverrideAllowed = userOverrideAllowed;
        }
    }

    private WebShieldPolicy() {}

    public static Decision decide(SafeWebEvaluator.Result local, Reputation reputation) {
        if (reputation == Reputation.KNOWN_MALICIOUS) {
            return new Decision(Action.BLOCK, "known malicious reputation", true, false);
        }
        if (reputation == Reputation.HIGH_RISK) {
            return new Decision(Action.BLOCK, "high-risk threat reputation", false, false);
        }
        if (local != null && local.decision == SafeWebEvaluator.Decision.BLOCK) {
            return new Decision(
                    Action.INTERSTITIAL,
                    "strong local heuristic risk; stop before navigation and require explicit review",
                    false,
                    true);
        }
        if (local != null && local.decision == SafeWebEvaluator.Decision.WARN) {
            return new Decision(Action.INTERSTITIAL, "local web risk requires review", false, true);
        }
        if (reputation == Reputation.KNOWN_BENIGN) {
            return new Decision(Action.ALLOW_WITH_CAUTION,
                    "known-benign reputation plus no blocking local signal", false, true);
        }
        return new Decision(Action.ALLOW_WITH_CAUTION,
                "no blocking evidence found; unknown does not mean safe", false, true);
    }
}
