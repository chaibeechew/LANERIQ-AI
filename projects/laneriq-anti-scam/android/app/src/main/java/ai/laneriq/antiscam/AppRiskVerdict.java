package ai.laneriq.antiscam;

public final class AppRiskVerdict {
    /** MALICIOUS is reserved for the future verified signed-evidence adapter. */
    public enum Verdict { MALICIOUS, HIGH_RISK, REVIEW, NO_HIGH_RISK_SIGNAL }

    public static final class Evidence {
        public final boolean unknownSigner;
        public final boolean sideloaded;
        public final int dangerousPermissionCount;
        public final boolean remoteControlCapability;

        public Evidence(boolean unknownSigner,
                        boolean sideloaded,
                        int dangerousPermissionCount,
                        boolean remoteControlCapability) {
            this.unknownSigner = unknownSigner;
            this.sideloaded = sideloaded;
            this.dangerousPermissionCount = Math.max(0, dangerousPermissionCount);
            this.remoteControlCapability = remoteControlCapability;
        }

        /**
         * Compatibility constructor for the earlier test/UI call shape.
         * The first three booleans intentionally have zero authority and are
         * ignored. They cannot manufacture a MALICIOUS verdict.
         */
        @Deprecated
        public Evidence(boolean ignoredKnownMaliciousReputation,
                        boolean ignoredScannerMalicious,
                        boolean ignoredSandboxMalicious,
                        boolean unknownSigner,
                        boolean sideloaded,
                        int dangerousPermissionCount,
                        boolean remoteControlCapability) {
            this(unknownSigner, sideloaded, dangerousPermissionCount, remoteControlCapability);
        }
    }

    public static final class Result {
        public final Verdict verdict;
        public final int riskScore;
        public final String reason;
        public final boolean malwareEvidencePresent;

        Result(Verdict verdict, int riskScore, String reason, boolean malwareEvidencePresent) {
            this.verdict = verdict;
            this.riskScore = riskScore;
            this.reason = reason;
            this.malwareEvidencePresent = malwareEvidencePresent;
        }
    }

    private AppRiskVerdict() {}

    /**
     * Current Android local evidence can produce risk/review outcomes only.
     * It may never manufacture MALICIOUS from metadata, permissions or a boolean flag.
     * The future signed-evidence adapter must be a separate verified path.
     */
    public static Result evaluate(Evidence evidence) {
        if (evidence == null) {
            return new Result(Verdict.REVIEW, 50, "missing app evidence", false);
        }

        int score = 0;
        if (evidence.unknownSigner) score += 20;
        if (evidence.sideloaded) score += 20;
        if (evidence.dangerousPermissionCount >= 8) score += 25;
        else if (evidence.dangerousPermissionCount >= 4) score += 15;
        if (evidence.remoteControlCapability) score += 35;
        score = Math.min(score, 90);

        if (score >= 55) {
            return new Result(Verdict.HIGH_RISK, score,
                    "multiple app risk signals require immediate review; not a malware or virus verdict", false);
        }
        if (score >= 20) {
            return new Result(Verdict.REVIEW, score,
                    "one or more app risk signals require review; not a malware or virus verdict", false);
        }
        return new Result(Verdict.NO_HIGH_RISK_SIGNAL, score,
                "no high-risk signal found in available local evidence; not proof the app is clean", false);
    }
}
