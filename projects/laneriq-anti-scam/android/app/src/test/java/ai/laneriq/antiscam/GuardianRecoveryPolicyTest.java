package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class GuardianRecoveryPolicyTest {
    @Test public void freshGuardianNeedsNoRecovery() {
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, true, true, true, 5,
                        ProtectionTruth.State.ACTIVE, "", 0));
        GuardianRecoveryPolicy.Decision d = GuardianRecoveryPolicy.evaluate(integrity, true, 0);
        assertEquals(GuardianRecoveryPolicy.Action.NONE, d.action);
        assertFalse(d.mayAttemptServiceStart);
    }

    @Test public void userReopenAfterProtectionLossCanAttemptRestore() {
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, false, true, 0,
                        ProtectionTruth.State.DEGRADED_OFFLINE,
                        "unexpected-service-destroy", 1));
        GuardianRecoveryPolicy.Decision d = GuardianRecoveryPolicy.evaluate(integrity, true, 1);
        assertEquals(GuardianRecoveryPolicy.Action.AUTO_RESTORE_ON_USER_OPEN, d.action);
        assertTrue(d.mayAttemptServiceStart);
        assertTrue(d.resetProtectedClaimBeforeRestart);
    }

    @Test public void crashLoopRequiresExplicitReviewInsteadOfInfiniteRestart() {
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, false, true, 0,
                        ProtectionTruth.State.DEGRADED_OFFLINE,
                        "restart-circuit-open",
                        RestartCircuitBreaker.MAX_RESTARTS_IN_WINDOW));
        GuardianRecoveryPolicy.Decision d = GuardianRecoveryPolicy.evaluate(
                integrity, true, RestartCircuitBreaker.MAX_RESTARTS_IN_WINDOW);
        assertEquals(GuardianRecoveryPolicy.Action.REQUIRE_EXPLICIT_REVIEW, d.action);
        assertFalse(d.mayAttemptServiceStart);
    }

    @Test public void userPauseNeverAutoRestarts() {
        GuardianRecoveryPolicy.Decision d = GuardianRecoveryPolicy.evaluate(null, false, 0);
        assertEquals(GuardianRecoveryPolicy.Action.USER_PAUSED, d.action);
        assertFalse(d.mayAttemptServiceStart);
    }
}
