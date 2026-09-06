package ai.laneriq.antiscam;

public final class LocalReputationAdmissionPolicy {
    private LocalReputationAdmissionPolicy() {}

    /**
     * Ordinary/local cache writes have no strong-verdict authority. A
     * KNOWN_MALICIOUS record must come through SignedThreatReputationEvidence
     * and is re-verified from its signed envelope when read from local cache.
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
