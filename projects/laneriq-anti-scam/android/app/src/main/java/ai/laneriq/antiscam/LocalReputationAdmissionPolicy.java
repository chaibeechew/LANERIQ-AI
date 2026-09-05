package ai.laneriq.antiscam;

public final class LocalReputationAdmissionPolicy {
    private LocalReputationAdmissionPolicy() {}

    /**
     * The current Android test build has no signed reputation ingestion path.
     * Therefore ordinary cache writes may never manufacture KNOWN_MALICIOUS.
     */
    public static boolean mayWriteUnverified(LocalThreatReputationStore.Verdict verdict) {
        return verdict == LocalThreatReputationStore.Verdict.HIGH_RISK
                || verdict == LocalThreatReputationStore.Verdict.KNOWN_BENIGN;
    }

    public static LocalThreatReputationStore.Verdict sanitizeStoredVerdict(
            LocalThreatReputationStore.Verdict verdict,
            boolean verifiedStrongEvidence) {
        if (verdict == null) return LocalThreatReputationStore.Verdict.UNKNOWN;
        if (verdict == LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS && !verifiedStrongEvidence) {
            return LocalThreatReputationStore.Verdict.UNKNOWN;
        }
        return verdict;
    }
}
