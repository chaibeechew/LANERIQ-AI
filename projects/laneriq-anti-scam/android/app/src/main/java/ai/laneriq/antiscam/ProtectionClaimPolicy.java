package ai.laneriq.antiscam;

public final class ProtectionClaimPolicy {
    public enum Claim {
        GUARDIAN_ACTIVE,
        LOW_LOCAL_RISK,
        CLEAN,
        BANKING_SAFE,
        GUARANTEED_PROTECTION
    }

    private ProtectionClaimPolicy() {}

    public static boolean mayClaim(
            Claim claim,
            ProtectionTruth.State truth,
            GuardianHealth.State health,
            String localRiskLevel,
            boolean scannerEvidence,
            boolean bankingEvidence) {
        if (claim == null) return false;

        boolean guardianActive = truth == ProtectionTruth.State.ACTIVE
                && GuardianHealth.mayClaimGuardianActive(health);

        switch (claim) {
            case GUARDIAN_ACTIVE:
                return guardianActive;
            case LOW_LOCAL_RISK:
                return guardianActive
                        && health == GuardianHealth.State.HEALTHY
                        && "low-local-signal".equals(normalize(localRiskLevel));
            case CLEAN:
                return guardianActive && scannerEvidence;
            case BANKING_SAFE:
                return guardianActive
                        && health == GuardianHealth.State.HEALTHY
                        && scannerEvidence
                        && bankingEvidence;
            case GUARANTEED_PROTECTION:
            default:
                return false;
        }
    }

    private static String normalize(String value) {
        return value == null ? "unknown" : value.trim().toLowerCase();
    }
}
