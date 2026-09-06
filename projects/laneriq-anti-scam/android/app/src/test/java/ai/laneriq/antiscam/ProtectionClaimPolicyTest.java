package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ProtectionClaimPolicyTest {
    @Test public void activeGuardianCanClaimGuardianActive() {
        assertTrue(ProtectionClaimPolicy.mayClaim(
                ProtectionClaimPolicy.Claim.GUARDIAN_ACTIVE,
                ProtectionTruth.State.ACTIVE,
                GuardianHealth.State.HEALTHY,
                "low-local-signal",
                false,
                false));
    }

    @Test public void p0CannotClaimCleanWithoutScannerEvidence() {
        assertFalse(ProtectionClaimPolicy.mayClaim(
                ProtectionClaimPolicy.Claim.CLEAN,
                ProtectionTruth.State.ACTIVE,
                GuardianHealth.State.HEALTHY,
                "low-local-signal",
                false,
                false));
    }

    @Test public void p0CannotClaimBankingSafeWithoutDedicatedEvidence() {
        assertFalse(ProtectionClaimPolicy.mayClaim(
                ProtectionClaimPolicy.Claim.BANKING_SAFE,
                ProtectionTruth.State.ACTIVE,
                GuardianHealth.State.HEALTHY,
                "low-local-signal",
                true,
                false));
    }

    @Test public void guaranteedProtectionIsNeverAllowed() {
        assertFalse(ProtectionClaimPolicy.mayClaim(
                ProtectionClaimPolicy.Claim.GUARANTEED_PROTECTION,
                ProtectionTruth.State.ACTIVE,
                GuardianHealth.State.HEALTHY,
                "low-local-signal",
                true,
                true));
    }
}
