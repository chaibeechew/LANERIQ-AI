package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class GuardianPausePolicyTest {
    @Test public void normalPauseStillRequiresExplicitConfirmation() {
        GuardianPausePolicy.Decision d = GuardianPausePolicy.evaluate(
                0,
                EmergencyModeStore.Level.NONE,
                false,
                false);
        assertEquals(GuardianPausePolicy.Action.REQUIRE_CONFIRMATION, d.action);
        assertFalse(d.mayStopImmediately);
    }

    @Test public void oneRemoteControlSignalRaisesPauseFriction() {
        GuardianPausePolicy.Decision d = GuardianPausePolicy.evaluate(
                1,
                EmergencyModeStore.Level.REVIEW,
                false,
                false);
        assertEquals(GuardianPausePolicy.Action.REQUIRE_HIGH_FRICTION_REVIEW, d.action);
        assertFalse(d.mayStopImmediately);
    }

    @Test public void urgentRemoteControlRiskBlocksOrdinaryPause() {
        GuardianPausePolicy.Decision d = GuardianPausePolicy.evaluate(
                2,
                EmergencyModeStore.Level.URGENT,
                false,
                false);
        assertEquals(GuardianPausePolicy.Action.BLOCK_DURING_URGENT_RISK, d.action);
        assertFalse(d.mayStopImmediately);
    }

    @Test public void selfIntegrityMismatchBlocksOrdinaryPause() {
        GuardianPausePolicy.Decision d = GuardianPausePolicy.evaluate(
                0,
                EmergencyModeStore.Level.NONE,
                false,
                true);
        assertEquals(GuardianPausePolicy.Action.BLOCK_DURING_URGENT_RISK, d.action);
    }

    @Test public void unexpectedProtectionLossRequiresHighFrictionReview() {
        GuardianPausePolicy.Decision d = GuardianPausePolicy.evaluate(
                0,
                EmergencyModeStore.Level.NONE,
                true,
                false);
        assertEquals(GuardianPausePolicy.Action.REQUIRE_HIGH_FRICTION_REVIEW, d.action);
    }
}
