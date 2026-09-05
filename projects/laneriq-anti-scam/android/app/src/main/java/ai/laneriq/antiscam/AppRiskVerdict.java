package ai.laneriq.antiscam;

public final class AppRiskVerdict {
    public enum Verdict { MALICIOUS, HIGH_RISK, REVIEW, NO_HIGH_RISK_SIGNAL }

    public static final class Evidence {
        public final boolean knownMaliciousReputation;
        public final boolean scannerMalicious;
        public final boolean sandboxMalicious;
        public final boolean unknownSigner;
        public final boolean sideloaded;
        public final int dangerousPermissionCount;
        public final boolean remoteControlCapability;

        public Evidence(boolean knownMaliciousReputation,
                        boolean scannerMalicious,
                        boolean sandboxMalicious,
                        boolean unknownSigner,
                        boolean sideloaded,
                        int dangerousPermissionCount,
                        boolean remoteControlCapability) {
            this.knownMaliciousReputation = knownMaliciousReputation;
            this.scannerMalicious = scannerMalicious;
            this.sandboxMalicious = sandboxMalicious;
            this.unknownSigner = unknownSigner;
            this.sideloaded = sideloaded;
            this.dangerousPermissionCount = Math.max(0, dangerousPermissionCount);
            this.remoteControlCapability = remoteControlCapability;
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

    public static Result evaluate(Evidence evidence) {
        if (evidence == null) {
            return new Result(Verdict.REVIEW, 50, "missing app evidence", false);
        }

        boolean malwareEvidence = evidence.knownMaliciousReputation
                || evidence.scannerMalicious
                || evidence.sandboxMalicious;
        if (malwareEvidence) {
            return new Result(Verdict.MALICIOUS, 100,
                    "dedicated malicious reputation/scanner/sandbox evidence", true);
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
                    "multiple app risk signals require immediate review; not a virus verdict", false);
        }
        if (score >= 20) {
            return new Result(Verdict.REVIEW, score,
                    "one or more app risk signals require review; not a virus verdict", false);
        }
        return new Result(Verdict.NO_HIGH_RISK_SIGNAL, score,
                "no high-risk signal found in available evidence; not proof the app is clean", false);
    }
}
