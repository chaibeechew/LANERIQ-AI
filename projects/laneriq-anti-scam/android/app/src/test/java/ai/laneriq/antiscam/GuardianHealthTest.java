package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class GuardianHealthTest {
    @Test public void activeLowRiskIsHealthy() {
        GuardianHealth.State state = GuardianHealth.evaluate(
                ProtectionTruth.State.ACTIVE, "low-local-signal", false, 0);
        assertEquals(GuardianHealth.State.HEALTHY, state);
        assertTrue(GuardianHealth.mayClaimGuardianActive(state));
    }

    @Test public void activeRiskSignalRequiresReviewButRemainsTruthful() {
        GuardianHealth.State state = GuardianHealth.evaluate(
                ProtectionTruth.State.ACTIVE, "review", false, 0);
        assertEquals(GuardianHealth.State.REVIEW_REQUIRED, state);
        assertTrue(GuardianHealth.mayClaimGuardianActive(state));
    }

    @Test public void staleLeaseCannotClaimActive() {
        GuardianHealth.State state = GuardianHealth.evaluate(
                ProtectionTruth.State.DEGRADED_STALE, "low-local-signal", false, 0);
        assertEquals(GuardianHealth.State.DEGRADED, state);
        assertFalse(GuardianHealth.mayClaimGuardianActive(state));
    }

    @Test public void restartLoopDegradesHealth() {
        GuardianHealth.State state = GuardianHealth.evaluate(
                ProtectionTruth.State.ACTIVE, "low-local-signal", false, 3);
        assertEquals(GuardianHealth.State.DEGRADED, state);
    }
}
