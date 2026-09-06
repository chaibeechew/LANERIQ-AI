package ai.laneriq.antiscam;

public final class AppRiskVerdict {
    /** MALICIOUS is reserved for verified signed evidence bound to the selected file hash. */
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
         * The first three booleans intentionally have zero authority and are ignored.
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
        public final String evidenceId;

        Result(Verdict verdict,
               int riskScore,
               String reason,
               boolean malwareEvidencePresent,
               String evidenceId) {
            this.verdict = verdict;
            this.riskScore = riskScore;
            this.reason = reason;
            this.malwareEvidencePresent = malwareEvidencePresent;
            this.evidenceId = evidenceId == null ? "" : evidenceId;
        }
    }

    private AppRiskVerdict() {}

    /** Local metadata produces risk/review outcomes only. */
    public static Result evaluate(Evidence evidence) {
        if (evidence == null) {
            return new Result(Verdict.REVIEW, 50, "missing app evidence", false, "");
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
                    "multiple app risk signals require immediate review; not a malware or virus verdict", false, "");
        }
        if (score >= 20) {
            return new Result(Verdict.REVIEW, score,
                    "one or more app risk signals require review; not a malware or virus verdict", false, "");
        }
        return new Result(Verdict.NO_HIGH_RISK_SIGNAL, score,
                "no high-risk signal found in available local evidence; not proof the app is clean", false, "");
    }

    /**
     * Strong malware verdict path. The verified evidence must be a FILE_SHA256
     * KNOWN_MALICIOUS token and must bind to the exact SHA-256 of the selected file.
     */
    public static Result evaluateWithVerifiedMalwareEvidence(
            Evidence localEvidence,
            String selectedFileSha256,
            SignedThreatReputationEvidence.VerifiedEvidence verifiedEvidence) {
        if (verifiedEvidence == null) return evaluate(localEvidence);
        String fileHash;
        try {
            fileHash = ThreatIndicator.canonicalFileHash(selectedFileSha256);
        } catch (Exception ignored) {
            return evaluate(localEvidence);
        }

        boolean boundMalwareEvidence =
                verifiedEvidence.indicatorType == SignedThreatReputationEvidence.IndicatorType.FILE_SHA256
                && verifiedEvidence.verdict == LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS
                && fileHash.equals(verifiedEvidence.indicatorHash);

        if (!boundMalwareEvidence) return evaluate(localEvidence);

        return new Result(
                Verdict.MALICIOUS,
                100,
                "trusted signed malware evidence matched the exact selected file hash",
                true,
                verifiedEvidence.evidenceId);
    }
}
